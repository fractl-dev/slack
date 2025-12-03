module slack

import "resolver.js" @as r

entity Message {
    id String @id,
    ts String,
    text String
}

resolver slack1 [slack/Message] {
    subscribe r.subsMessages
}
