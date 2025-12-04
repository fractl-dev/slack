module slack

import "resolver.js" @as r

entity Message {
    id String @id,
    ts String @optional,
    text String,
    userMessage Boolean @default(true)
}

resolver slack1 [slack/Message] {
    create r.createMessage,
    subscribe r.subsMessages
}
