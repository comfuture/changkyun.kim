---
title: 몽고디비 페이징과 룩업 성능
cover_image: /article/2020-06/20-mongo.jpg
description: >
  몽고디비 aggregation을 페이징 할 때 성능 문제 해결기
---

몽고디비는 도큐먼트DB 특성상 기존 RDBMS와는 데이터를 다루는 철학에 차이가 조금 있다.

이번에 회사 프로덕트를 만들면서 여러 컬렉션을 참조하는 목록을 페이징하는 쿠에리에서 심각하게 성능저하가 일어나는 것을 발견하여 이를 해결하는 과정을 소개한다.

우선, 페이징을 구현하기 위해서는 전체 컬렉션 또는 커서의 일부분만 잘라내어 fetch 해줄 방법이 필요하다.
몽고디비에는 `.skip()` 과 `.limit()` 체인메소드를 기본 제공하기 때문에 이 부분에는 문제가 없다.

하지만 총 몇 page가 존재하는지(또는 이전/다음 페이지가 존재하는지)를 알기 위해서는 커서의 총 도큐먼트 수를 알아내야 할 필요가 있다.
과거 3.x 이전 버전에서는 우선 cursor를 만든다음 클론하여 하나는 도큐먼트 수를 세는데, 하나는 커서의 일부를 잘라내는데 사용했었다.

```js
mongo> var cursor = db.contents.find(query)
mongo> var total = cursor.clone().count()
mongo> cursor.skip((page - 1) * itemPerPage).limit(itemPerPage)
```

## 페이징할 문서 전체의 갯수 가져오기

4.x 부터는 `cursor.count()` 메소드 사용을 지양하고 `collection.countDocuments(query)` 또는 `collection.estimatedDocumentCount(query)` 를 대신 사용할 것을 권장할 뿐 아니라, 일부 드라이버에서는 이미 `cursor.count()` 메소드가 deprecate 되어있다. 여기에는 함정이 숨어있는데, 단순 `collection.find()`가 아닌 aggregation의 경우에는 해당되지 않는다는 점이다.

aggregation을 페이징 하려면 `AggregationPipeline.count()` 를 조회하는 대신 pipeline의 일정 단계 이후 스테이지를 분기하여 각각 `도큐먼트 수` 및 `페이징된 커서` 를 얻는데 사용해야 한다.
스테이지를 여러개로 분리하는데는 `$facet` 스테이지를 활용하면 한번의 오퍼레이션으로 두가지 정보를 한꺼번에 가져올 수 있다.

(여기서부터는 헬퍼 코드를 작성했기 때문에, mongo shell 대신 각종 언어 드라이버 기준으로...)

```python
@dataclass
class PagedAggregation(object):

    page: int = 1
    page_size: int = 10
    total: int = 0
    items: List[dict] = field(default_factory=list)

    def __iter__(self) -> Generator[dict]:
        yield from self.items

    def __json__(self) -> dict:
        return {
            'page': self.page,
            'pageSize': self.page_size,
            'total': self.total,
            'totalPages': math.ceil(self.total / self.page_size),
            'items': self.items
        }

def paged(collection: Collection, pipeline: List=[], page=1, page_size=10) -> PagedAggregation:
    """
    generates an aggregation facet pipeline, then fetch
    """
    pager = {'$facet': {
        'metadata': [
            {'$count': 'total'},
            {'$addFields': {'page': page}}
        ],
        'items': [
            {'$skip': (page - 1) * page_size},
            {'$limit': page_size}
        ]
    }}

    paged_pipeline = pipeline[:]
    paged_pipeline.append(pager)
    doc = next(collection.aggregate(paged_pipeline))

    return PagedAggregation(
        page=page,
        page_size=page_size,
        total=doc['metadata'][0]['total'],
        items=doc['items']
    )
```

구글링과 스택넘침질로 얻은 각종 스킬들을 조합하여 나름 꽤 심플하고 합리적으로 aggregate의 페이징을 정리한 듯 했다[^1].
하지만 문서 수가 수십만을 넘기 시작하면서, 파이프라인에서 다른 컬렉션을 $lookup 하는 빈도가 늘어나면서 성능이 심각할 정도로 나빠지기 시작했다.

개인적으로는 실행 계획(explain)을 눈으로 짐작하기 쉽지 않은 SQL보다 각 단계에서 할 일을 순차적으로 명시하는 aggregation pipeline 쪽이 훨씬 낫다고 생각했었다.
물론 그 사실에는 변함이 없지만, 데이터를 "관계"로 바라보는 RDBMS와 다르게 "도큐먼트"로 바라보는 몽고디비의 철학에서 내가 원하는 "결과"만을 목적으로 파이프라인을 짜다보면 자신이 놓은 함정에 걸리게 되는 경우가 생긴다.

위에 작성한 `paged` 헬퍼를 이용하여 평균 20여개의 코멘트가 달린 100만건의 블로그 글 목록에서 내가 작성한 글의 일부 페이지를 가져오려고 한다면,

```python
pipeline = [
  {'$match': {
    'author_id': me
  }},
  {'$lookup': {
    'from': 'comments',
    'localField': '_id',
    'foreignField': 'article_id',
    'as': 'comments'
  }}
]

paged(db.articles, pipeline, page=100, page_size=10)
```

이런 식이 될 것이다.

`$lookup` 스테이지가 `$skip`, `$limit` 스테이지보다 앞서 등장하기 때문에 10개의 도큐먼트를 얻기 전에 100만건 article 모두에 대한 comment 를 미리 lookup 하게 되어, 사실상 문서마다 20개의 댓글을 포함하여 총 2000만개의 도큐먼트를 조회한 후 그중 일부를 가져오게 된다.
aggregation pipeline은 메모리상에서 최대 100MB만 사용할 수 있는 제약사항이 있기 때문에 스테이지의 일부 단계에서 문서 갯수가 많거나 메모리를 초과할 것으로 예상된다면 미리 `allowDiskUse` 옵션을 활성화 시켜 두지 않았다면 최종 10개 문서(x20개 댓글)를 가져오기 전에 이미 메모리 부족 에러를 만날 가능성도 있다.

위 예시의 경우는 페이징을 마치 RDBMS의 `LIMIT n, m` 으로 다루듯 마지막 단계에만 페이징을 위한 스테이지를 추가하는 경우를 보여주는 예시로, 몽고디비에서 쉽게 저지를 수 있는 실수에 해당한다.
`$lookup` 스테이지를 직접 `$limit` 스테이지 다음으로 옮겨두면 극적으로 성능 향상을 기대할 수 있다.

`$lookup`된 외래 도큐먼트의 속성을 `$match` 스테이지에서 활용하고자 하는 경우엔 이야기가 달라진다.

> 19세 미만 미성년자가 작성한 글과 댓글을 가져오려는 경우..

```python
pipeline = [
  {'$lookup': {
    'from': 'author',
    'localField': 'author_id',
    'foreignField': '_id',
    'as': 'author'
  }},
  {'$unwind': '$author'},
  {'$match': {
    'author.age': {'$lte': 19}
  }},
  {'$lookup': {
    'from': 'comments',
    'localField': '_id',
    'foreignField': 'article_id',
    'as': 'comments'
  }}
]
```

이런 경우는 3번째에 등장하는 `$match` 스테이지에서 `author.age`를 조건으로 사용하기 위해 미리 `$lookup` 하지 않을 수 없기 때문에 `$lookup`의 순서를 뒤로 미뤄 성능 향상을 기대할 수는 없다.
RDBMS에서는 자주 등장할 수 있는 쿠에리지만 `JOIN`되는 필드에 외래키, 인덱스가 적절히 걸려있다면 심각한 성능 저하가 발생하지는 않는다.

`$lookup`을 최적화 하는 과정은 아직도 진행단계고 좀 긴 넋두리가 필요하므로 다음기회(가 있다면)에 소개하기로 한다.

## $facet 퍼포먼스 문제

두번째로 발견한 성능저하의 문제는, `$facet`의 퍼포먼스가 너무 좋지 않다. 하나의 pipeline을 둘로 나누어 병렬로 실행한다 라는 아이디어는 깜찍하고 좋았지만,
실제 실행 단계에서 나뉘기 전 스테이지까지의 결과를 재활용하기는 하는건지 의심스러울 정도로 `$facet`가 등장하는 aggregation은 성능이 항상 좋지 않았다.

또한, 문서 수 및 문서 목록을 하나의 파이프라인에서 모두 연산해 올 때 까지 대기해야 하므로 replicaSet의 분산 처리 도움을 별로 받지 못한다.

nodejs 에서는 mongoos 라이브러리의 구현을 조금 참조하여 `$facet`를 쓰지 않고 두번에 나누어 (동시에)실행하도록 paged 헬퍼를 수정했다.

```js
/**
 * 몽고디비 aggregation 을 페이징한다
 * @async
 * @param {Collection} collection 몽고디비 컬렉션
 * @param {object | object[]} condition query 또는 aggregation 파이프라인
 * @param {object} [options]
 * @param {number} [options.page = 1] 페이지번호
 * @param {number} [options.pageSize = 10] 페이지당 문서 갯수
 * @returns {Promise<PagedCursor>}
 */
export const paged = (collection, condition, {page = 1, pageSize = 10} = {}) => {
  let pipeline = []
  if (Array.isArray(condition)) { // aggregation pipeline인 경우
    pipeline.push.apply(pipeline, condition)
  } else {  // query only인 경우
    pipeline.push({$match: condition})
  }

  const countPipeline = [...pipeline].filter(elm => !elm['$sort'])
  countPipeline.push({ $group: { _id: null, count: { $sum: 1 }}})

  const pagedPipeline = [...pipeline]
  pagedPipeline.push({$skip: (page - 1) * pageSize})
  pagedPipeline.push({$limit: pageSize})

  return Promise.all([
    collection.aggregate(pagedPipeline, {allowDiskUse: true}).toArray(),
    collection.aggregate(countPipeline, {allowDiskUse: true}).toArray()
  ])
  .then(([items, countResult]) => {
    const total = countResult.length > 0 ? countResult.shift().count : 0
    const totalPages = Math.ceil(total / pageSize)
    return {
      page, pageSize, total, totalPages, items
    }
  })
}
```


## lazy loading 전략

`$lookup` 스테이지의 목적이 단순히 다른 컬렉션의 일부 정보를 가져와 도큐먼트의 속성에 끼워넣어 주기를 바라기만 하는 경우라면 굳이 `$lookup` 스테이지를 활용하지 않고,
연관 도큐먼트를 별도로 조회한 다음 결과 목록에 확장시켜주어도 성능엔 큰 차이가 없다. (orm 의 eager/lazy loading 전략과 비슷)

사실은 원시 컬렉션의 외래키를 수집하여 어플리케이션 서버에서 다시 두번째 쿠에리를 만들어 DB서버에 전송하는 것을 비효율적이지만, 어플리케이션 서버와 DB서버의 네트워크 거리가 충분히 가까운 경우라면
`$lookup` 을 이용하여 몽고디비 내에서 연관 컬렉션을 조회하는 것과 거의 성능의 차이가 없고 어떤 경우는 더 좋은 경우도 있었다.

이런 역할을 하는 `lookup()` 헬퍼를 nodejs 버전으로 작성했다. 파라메터 종류는 `$lookup($aggregation)` 과 거의 같다.

```js
/**
 * @param {DataBase} db
 * @param {object} information
 * @param {string} information.from 참조할 컬렉션 이름
 * @param {string} information.localField 외래키에 대응할 로컬 키 이름
 * @param {string} information.foreignField 왜래키 이름
 * @param {string} information.as 참조된 왜래 컬렉션의 아이템을 매핑할 속성명
 * @returns {lookup~filler}
 */
export const lookup = (db, {from, localField, foreignField, as, project = {}}) => {
  /**
   * @function lookup~filler
   * @returns {PagedCursor}
   */
  return ({items, ...rest}) => {
    const ids = items.map(item => item[localField])
    return db.collection(from).find({
      [foreignField]: {$in: ids}
    }, {$project: project}).toArray().then(props => {
      const propIds = props.map(prop => '' + prop[foreignField])
      return {items: items.map(item => {
        let index = propIds.indexOf('' + item[localField])
        if (index > -1) {
          item[as] = props[index]
        }
        return item
      }), ...rest}
    })
  }
}

/**
 * 여러개의 lookup을 동시에 수행한다
 */
export const lookupAll = (db, ...desires) => {
  return ({items, ...rest}) => Promise.all(desires.map(desire => lookup(db, desire)({items, ...rest})).then(([r]) => r)
}
```

이렇게 사용한다.

```js
paged(db.collection('galaxy'), [{$match: {answer: 42}}], {page, pageSize})
  .then(lookup(db, {
    from: 'hitchiker',
    localField: '_id',
    foreignField: 'galaxy_id',
    as: 'hitchhikers'
  }))
```

요즘은 대부분 그렇지 않지만 RDBMS의 `LIMIT n, m`  만으로 문서의 페이징을 하는 경우에도 100만건 정도의 문서에서는 꽤 성능이 나오지 않았던 과거를 떠올려본다.

프로그램을 짜다 보면 데이터 설계 당시의 의도와는 다르게 복잡한 조회 조건이나 외래 키 없는 다른 데이터 컬렉션을 참조하고 싶다는 요구를 종종 받게 된다.
이때마다 인덱스나 외래키를 추가할 수는 없는 일이다. 결국 상황에 맞는 정교한 pipeline을 매번 잘 짜거나, 언어레벨의 서포트로 극뽁하는 수 밖에..

조금은 무책임한 `$lookup`과 `$facet`의 퍼포먼스 문제로 약간은 당황했지만, mongodb만의 문제는 아닌 것으로.. 계속해서 발전하는 몽고디비가 되기를


[^1]: 실제로 일반적인 경우엔 나쁘지 않은 성능으로 페이징 하는데 문제가 없다