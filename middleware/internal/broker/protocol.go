package broker

import "encoding/json"

const (
	msgTypeSubscribe   = "subscribe"
	msgTypeUnsubscribe = "unsubscribe"
	msgTypePublish     = "publish"
	msgTypeAck         = "ack"
	msgTypeEvent       = "event"
	msgTypeError       = "error"

	peerHello       = "peer_hello"
	peerTopicAdd    = "peer_topic_add"
	peerTopicRemove = "peer_topic_remove"
	peerPublish     = "peer_publish"
)

type wireMessage struct {
	Type     string          `json:"type"`
	Topic    string          `json:"topic,omitempty"`
	Payload  json.RawMessage `json:"payload,omitempty"`
	ReqID    string          `json:"req_id,omitempty"`
	Action   string          `json:"action,omitempty"`
	Status   string          `json:"status,omitempty"`
	Info     string          `json:"info,omitempty"`
	Message  string          `json:"message,omitempty"`
	BrokerID string          `json:"broker_id,omitempty"`
	PeerAddr string          `json:"peer_addr,omitempty"`
	ID       string          `json:"id,omitempty"`
	Origin   string          `json:"origin,omitempty"`
}
