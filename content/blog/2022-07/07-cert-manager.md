---
title: microk8s 에서 letsencrypt 인증서 사용하기
createdAt: 2022-07-07
tags:
  - oracle cloud
  - k8s
  - microk8s
---

[오라클 프리티어 클라우드에 무료 k8s 클러스터 만들기](https://changkyun.kim/article/2022-05/12-free-k8s-cluster-on-oracle-cloud) 에 이어, k8s에 올리는 웹서비스들에 letsencrypt 인증서를 사용하는 과정을 진행했습니다.

보통 nginx 라면 certbot 등을 이용하면 되겠지만, k8s 에서는 cert-manager 를 이용해야만 합니다.

```bash
$ helm repo add jetstack https://charts.jetstack.io
$ helm repo update
$ kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.8.2/cert-manager.crds.yaml
$ helm install \
  cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --version v1.8.2
```

helm3 이 활성화된 상태에서 위 명령들을 입력하여 cert-manager CRD 및 관련 챠트를 설치합니다. 그다음 letsencrypt cluster issuer를 설치합니다.

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-production
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: yourname@example.com
    # Name of a secret used to store the ACME account private key
    privateKeySecretRef:
      name: letsencrypt-production
    solvers:
      - selector: {}
        http01:
          ingress:
            class: public
```

인터넷에 많이 올라온 자료에는 ingress class 를 `ngnix` 로 하라고 되어있지만 microk8s 에서는 public 이 사용된다고 합니다. 그런데 약간 시간이 지났는데도 ClusterIssuer 의 ready 상태가 `False` 인 채 바뀌지 않았습니다.

로그를 살펴보니 클러스터 안쪽 컨테이너에서 `acme-v02.api.letsencrypt.org` 도메인을 리졸브하지 못해서 ACME 어카운트가 생성되지 않고 있는 탓이었습니다.

coredns 는 처음부터 활성화해 두었지만 다시한번 살펴봅니다.

```text
$ microk8s enable dns
```

coredns 설정들은 기본적으로 cluster의 이름풀기를 우선하고, 호스트머신의 resolv.conf 를 honor 하도록 되어있습니다. 우분투머신의 이름풀기는 구글의 8.8.8.8, 8.8.4.4 를 바라보게 되어있었으므로 별다른 설정 없이 되어야 정상인데 그렇지 않은 이유를 한동안 이유를 알 수 없었습니다. 이걸 해결하려고 잘 알지도 못하는 calico를 만지작거리다가 클러스터를 한번 날려먹었습니다. (link: [calico 완전히 삭제](https://togomi.tistory.com/17))

저는 아직 올린 서비스는 없었기 때문에 적당한 과거까지 지워버린다음 설치중 작성했던 yaml 파일들을 기억에 의존해 복기했는데 놀랍게도 빠른 시간안에 완벽히 복기해낼 수 있었습니다.

원인은 k8s가 쓰는 브릿지 네트워크까지 패킷이 도달하지 못하기 때문이었습니다. (최신 우분투 패키지의 기본값인지, 오라클 클라우드의 정책인지 알지 못합니다) NAT 안쪽까지 TCP/UDP 패킷이 드나들 수 있도록 iptables 설정을 바꿔줍니다

```bash
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT
```

이제 coredns가 재실행되도록 파드를 삭제합니다.

```bash
$ kubectl delete pod coredns-xxxxx-yyyyy
```

즉시 되살아나며 이제는 각 파드의 컨테이너 안에서 이름풀기가 문제없이 되는것을 확인합니다.

이제 샘플 웹서비스를 하나 외부에 노출시켜 SSL을 적용해보겠습니다.

microk8s 명령을 이용하여 필요한 서비스들을 설치합니다.

```bash
$ microk8s enable ingress metallb
```

microk8s 에서는 기본적으로 nginx-ingress 를 사용합니다. sudo 권한 없이 위 명령을 입력하는 것 만으로 호스트머신에 nginx가 설치되어 externalIPs 로 부터 받는 요청들을 k8s 클러스터 안쪽으로 전달해주는 것을 볼 수 있습니다. (와우 e 편한 세상 +\_+) 다만, 로드벨런싱을 위해 matallb 를 설치하고 내부아이피의 일부를 할당했습니다

직접 아래와 같이 범위할당을 할 수도 있습니다.

```bash
microk8s enable metallb:10.64.140.43-10.64.140.49
```

ingress service를 만들어 노출합니다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ingress
  namespace: ingress
spec:
  selector:
    name: nginx-ingress-microk8s
  type: LoadBalancer
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 80
    - name: https
      protocol: TCP
      port: 443
      targetPort: 443
```

준비는 끝났습니다. 이제 각 서비스용 ingress에 특별한 annotation 을 추가하는 것만으로 몇 분 안에 SSL을 적용할 수 있습니다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: testweb
  annotations:
    ingress.kubernetes.io/ssl-redirect: "true"
    kubernetes.io/tls-acme: "true"
    acme.cert-manager.io/http01-edit-in-place: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-production"
spec:
  tls:
    - hosts:
        - testweb.mydomain.com
      secretName: "letsencrypt-testweb" # 적당한 이름을 작성하면 됨
  rules:
    - host: testweb.mydomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: testweb
                port:
                  number: 80
```

`$ kubectl apply -f k8s/ingress.yaml` 명령으로 적용하면 cert-manager가 cert-manager/certification 을 만들고 검증에 필요한 몇개의 pod와 ingress를 만들어 노출하는 것을 볼 수 있습니다. 잠시동안 `http://testweb.mydomain.com/.well-known/acme-challenge/aaabbbccc...very.long.url` 엔드포인트가 열립니다. 이는 ClusterIssuer의 solver 를 http01 로 지정했기 때문인데, 잠시 후 letsencrypt로부터 몇번의 http 요청이 들어오고 SSL 인증서 발급이 완료됩니다. 발급된 후에는 검증용 엔드포인트 및 관련 리소스들이 알아서 깨끗하게 해제됩니다.

- `spec.tls.hosts` 에 사용하고싶은 도메인을 나열하고 `spec.tls.secretname` 에 적당한 이름을 지정해줍니다. 이 이름의 secret 에 개인키가 저장됩니다.
- `cert-manager.io/cluster-issuer: "letsencrypt-production"` 여기에는 ClusterIssuer 를 만들 때 지정한 이름을 적어줍니다.
- `acme.cert-manager.io/http01-edit-in-place: "true"` annotation은 별도의 ingress 를 만들지 않고 이 Ingress 설정에 rules 를 추가해서 재사용하겠다는 의미인데, 호스트머신의 네트워크등 문제가 없다면 생략해도 됩니다.
- `ingress.kubernetes.io/ssl-redirect: "true"` annotation은 http 주소를 자동으로 https 로 리다이렉트 해달라는 의미입니다. (그럴일 없지만)http 를 병용한다면 제거해야 합니다.

> 사실 이번 과정에서는 제법 시행착오가 있었는데, 시간이 지난 후 기록을 남기는 과정에서 시행착오 부분의 에러 메시지들과 해결과정을 되살려 적을 수가 없어 모두 생략했습니다.
