---
title: 오라클 프리티어 클라우드에 무료 k8s 클러스터 만들기
createdAt: 2022-05-12
---

클라우드에는 후발주자로 뛰어든 오라클이 혜자로운 용량의 무료 리소스를 평생 제공한다.

https://www.oracle.com/kr/cloud/free/

가입하면 즉시 400 SGD (미화 약 $300) 의 크레딧을 30일간 사용할 수 있고, 이후에도 최대 4 Core 24 GB Arm 인스턴스를 상시 무료로 이용할 수 있다.
보통 다른 클라우드에서 1코어 1기가 1년간 무료로 주는것 대비 상당한 혜택인 것을 감지하고 몇가지 사용해보기로 마음을 먹었다.

타 클라우드 사용 경험이 있었으므로 인스턴스를 생성하고 인터넷 네트워크 게이트웨이와 서브넷의 시큐리티 규칙을 적용하는 데는 어려움이 없었다.
다만 subnet의 ingress 규칙을 허용하고 새 시큐리티 그룹을 만들어 포트를 개방해도 외부에 80번 포트와 443 포트를 개방할 수가 없었다.

오라클 프리티어를 가입 후 트라이얼 고객 대상 컨설턴트로부터 받은 이메일이 생각나서 질문을 회신했다.
몇 차례 메일이 오고간 뒤, 감사하게도 원격지원으로 도와주겠다는 제안을 했다.

## 웹용 포트 개방

원인은 운영체제 파이어월 때문이었다.
본래 우분투 리눅스에서는 [ufw](http://manpages.ubuntu.com/manpages/bionic/man8/ufw.8.html) 를 iptables 의 프론트엔드로 쓰고 있다는 것만 알고 있었는데,
최근에 이게 [firewalld](http://manpages.ubuntu.com/manpages/bionic/man1/firewall-cmd.1.html) 기반으로 바뀐듯 했다.

ufw 는 기본 apt패키지로 설치되어 있으나 `ufw allow [port]`, `ufw enable/disable` 등이 기대하는대로 동작하지 않았다.

`sudo apt install firewalld` 명령으로 firewall-cmd cli도구를 설치하고 다음과 같은 명령줄로 포트 또는 서비스를 개방할 수 있었다.

```bash
$ sudo firewall-cmd --permanent --zone=public --add-service=http
$ sudo firewall-cmd --permanent --zone=public --add-service=https
$ sudo firewall-cmd --permanent --zone=public --add-port=16443/tcp
$ sudo firewall-cmd --reload
$ sudo firewall-cmd --list-all --zone=public
```

(최근 리눅스 배포판들에서는 iptables 도 퇴역하고 nftables 를 쓴다는 이야기를 들은듯 하여 이 부분도 확인 필요)

컨설턴트께서 firewall-cmd 의 존재를 각인시켜주신 덕분에 문제 없이 해결할 수 있었다. 이자리를 빌어서 감사의 인사를 드립니다.

## 도커 설치
이제 도커와 쿠버네티스 사용을 위한 설치를 하자.

```bash
$ sudo apt-get remove docker docker-engine docker.io containerd runc
$ sudo apt-get update
$ sudo apt-get install \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
$ curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
$ echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
$ sudo apt-get update
$ sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

일반 유저 권한으로 `docker` 명령을 사용할 수 있도록 하기 위해

```bash
$ sudo usermod -a -G docker [유저명]
```

> usermod 명령이 배포판에 따라 옵션을 묶어쓰면 안되기도 하니 주의. 레드햇 기반에서는 `usermod -aG ...` 가 유효했는데 데비안 계열에선 띄어 써야 유효했다.

## 쿠버네티스 설치
kubectl 설치 가이드 중에는 x86-64 아키텍쳐를 가정하고 설명되어 있는 것이 많았다. 붙여넣기 명령중에 `x86-64` 서픽스를 가진 패키지 이름이 있는지 주의하여 설치한다.

싱글 노드에서 쿠버네티스를 사용하기 위한 작은 클러스터 배포판이 여러개 있어서 사용에 고민을 했다.

KIND (**K**ubernetes **IN** **D**ocker) 사용 경험이 있어서 설치해보았으나 로컬 머신에서 테스트 용도로는 적합하나 실제 원격에서 접속할 클러스터로는 부족한점이 보였다.

k3s 와 microk8s 는 arm 아키텍쳐와 매우 작은 사이즈의 컨트럴페인을 장점으로 내세우고 있다. (raspberry pi 에 설치하라고 할 정도로)
이번엔 우분투 20.04 에 설치를 위해 같은 canonical 제품인 microk8s 를 써보기로 했다.

설치는 apt 명령을 통해 간단.
기본 설치가 끝난 후 `microk8s kubectl [...명령줄]` 명령으로 cli 를 쓸 수 있었는데 이는 kubeconfig 에 기본적으로 컨텍스트를 밀어넣어주지 않기 때문이다. (작고 포터블한 것을 장점으로 내세우고 있으므로)

```bash
$ sudo microk8s config > $HOME/.kube/config
```
명령으로 컨피그를 만든 후에는 그냥 `kubectl` 명령을 쓸 수 있다.

## 쿠버네티스 API 외부에 노출하기
이제 원격으로 내 데스크탑에서도 사용을 하기 위해 api 서비스를 외부에 개방해야 한다.
위에 포트 개방 단계에서 tcp 16443 을 개방한 이유가 바로 이것인데, microk8s는 6443 대신 16443 포트에 api 서비스가 돌고 있다.

내 데스크탑에서 microk8s 의 kubeconfig 를 추가한다.
이때는 이미 사용중인 컨텍스트를 덮어쓰지 않도록 [이 가이드](https://medium.com/@jacobtomlinson/how-to-merge-kubernetes-kubectl-config-files-737b61bd517d) 를 참조하여 `kubectl config merge` 를 실행하자.

컨피그에는 서버 주소가 `server: https://10.0.0.41:16443` 등으로 명시되어 있는데, 설치된 인스턴스의 퍼블릭IP로 바꿔주어야 한다.

여기까지 해도 원격에서 kube 컨텍스트를 아직 사용할 수 없다. 퍼블릭 IP 에 대한 올바른 ssl 인증서가 없기 때문이다.
처음엔 nginx 를 통해 letsencrypt 인증서를 받은 버츄얼 호스트로 https://10.0.0.41:16443 를 proxy-forward 하려고 시도했지만, 알 수 없는 인증기관을 사용한다며 실패했다.

[올바른 방법](https://microk8s.io/docs/services-and-ports)은 microk8s 의 cert 템플릿을 수정하여 내 도메인과 퍼블릭IP에 대한 cert를 부여받는 것이다.

`/var/snap/microk8s/current/certs/csr.conf.template` 파일의 `[alt_names]` 섹션에 DNS.* = 항목을 하나 추가하여 내 도메인을 적는다.

```
[ alt_names ]
DNS.1 = kubernetes
DNS.2 = kubernetes.default
DNS.3 = kubernetes.default.svc
DNS.4 = kubernetes.default.svc.cluster
DNS.5 = kubernetes.default.svc.cluster.local
DNS.6 = mydomain.com
```

그다음

```bash
$ sudo microk8s refresh-certs -e ca.crt
```

명령으로 인증서를 갱신하면 자동으로 microk8s 서비스가 재시작된다.


이제 로컬 머신에서 `kubectl get all --all-namespaces` 명령으로 원격지의 쿠버네티스 클러스터가 잘 동작하는지 확인해보자.

아직 아무 서비스도 안 올리긴 했지만 24GB의 넉넉한 메모리가 있는 머신에서 메모리는 5%정도밖에 쓰이지 않고 있다.
개인용으로는 충분하고도 남는 리소스이다.

이제 30일간 쓸 수 있는 400 SGD 크레딧으로 인스턴스를 몇 개 더 켜서 멀티노드를 구성해보는 실험을 해봐야겠다.
