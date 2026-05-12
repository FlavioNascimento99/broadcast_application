# Middleware Pub/Sub Distribuido (Go)

## Visao geral
Este projeto implementa um middleware Publish/Subscribe com:
- Broker: gerencia conexoes, topicos, inscritos e encaminhamento de mensagens.
- Biblioteca (API): abstrai o protocolo e o balanceamento de carga.
- Aplicacao de exemplo: publishers e subscribers em processos separados.

## Protocolo (JSON line-delimited)
Cada mensagem e uma linha JSON.

Cliente -> Broker:
- subscribe: {"type":"subscribe","topic":"localizacao","req_id":"..."}
- unsubscribe: {"type":"unsubscribe","topic":"localizacao","req_id":"..."}
- publish: {"type":"publish","topic":"localizacao","payload":{...},"req_id":"..."}

Broker -> Cliente:
- ack: {"type":"ack","action":"publish","topic":"...","status":"delivered|discarded|ok|error","req_id":"..."}
- event: {"type":"event","topic":"...","payload":{...}}
- error: {"type":"error","message":"...","req_id":"..."}

Broker <-> Broker:
- peer_hello
- peer_topic_add / peer_topic_remove
- peer_publish

## Como executar
Requisitos: Go 1.21+

### 1) Subir dois brokers em mesh
Obs: o parametro -peers deve listar os enderecos de peer (porta de peer), nao a porta de cliente.
Terminal A:
```
go run ./cmd/broker -client-addr :9000 -peer-addr :9100 -peers localhost:9101
```
Terminal B:
```
go run ./cmd/broker -client-addr :9001 -peer-addr :9101 -peers localhost:9100
```

### 2) Subir dois subscribers (2 processos)
Terminal C:
```
go run ./cmd/subscriber -brokers localhost:9000,localhost:9001 -topics localizacao,sensor_temperatura -name sub-1
```
Terminal D:
```
go run ./cmd/subscriber -brokers localhost:9000,localhost:9001 -topics sensor_umidade,sistema_status -name sub-2
```

### 3) Subir dois publishers (2 processos)
Terminal E:
```
go run ./cmd/publisher -brokers localhost:9000,localhost:9001 -topic localizacao -name pub-1 -interval 1s
```
Terminal F:
```
go run ./cmd/publisher -brokers localhost:9000,localhost:9001 -topic sensor_temperatura -name pub-2 -interval 2s
```

Para completar os 4 topicos, voce pode iniciar mais dois publishers:
```
go run ./cmd/publisher -brokers localhost:9000,localhost:9001 -topic sensor_umidade -name pub-3 -interval 1500ms
```
```
go run ./cmd/publisher -brokers localhost:9000,localhost:9001 -topic sistema_status -name pub-4 -interval 3s
```

## Cenario de teste (minimo)
- 2 publishers
- 2 subscribers
- 4 topicos distintos

## Regras de topicos e encaminhamento
- Topicos sao criados no broker quando o primeiro cliente se inscreve.
- Topicos sao removidos no broker quando o ultimo inscrito local sai.
- Se nao houver inscritos em nenhum broker, a publicacao e descartada e o publisher recebe status "discarded".
- O envio para inscritos usa buffers por conexao para nao bloquear o recebimento.

## Balanceamento de carga e escalabilidade
- A biblioteca do cliente escolhe o broker por round-robin no primeiro uso do topico.
- Brokers em mesh reencaminham publicacoes e propagam presenca de topicos.
- Para manter conhecimento global de inscritos, configure os brokers em mesh total (todos conectados entre si).
