function getApiKey() {
    return process.env['SLACK_API_KEY']
}

function getChannel() {
    return process.env['SLACK_CHANNEL_ID']
}

const SlackBaseUrl = "https://slack.com/api"

function getUrl(endpoint) {
    return SlackBaseUrl + "/" + endpoint
}

function StandardHeaders() {
    return {
        "Authorization": "Bearer " + getApiKey(),
        "Content-Type": "application/json"
    }
}

async function handleFetch(url, req) {
    try {
        const response = await fetch(url, req);
        if (!response.ok) {
            return { error: `HTTP error! status: ${response.status} ${response.text} ${response.statusText}` }
        }
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}

let lastTs = "0"

const JiraBaseUrl = process.env['JIRA_BASE_URL']

export async function createMessage(resolver, inst) {
    const apiUrl = getUrl("chat.postMessage")
    const jiraUrl = `${JiraBaseUrl}/browse/${inst.lookup('id')}`
    const r = await handleFetch(apiUrl, {
        method: 'POST',
        headers: StandardHeaders(),
        body: JSON.stringify({
            channel: getChannel(),
            thread_ts: lastTs,
            markdown_text: `<${jiraUrl}|Issue created>
            ${inst.lookup('text')}`,
            mrkdwn: true
        })
    });
    return inst
}

async function getAndProcessLastMessage(resolver) {
    const ts = lastTs
    const apiUrl = getUrl(`conversations.history?channel=${getChannel()}&oldest=${ts}&limit=5&inclusive=false`)
    const resp = await handleFetch(apiUrl, {
        method: 'GET',
        headers: StandardHeaders()
    });
    const msgs = resp['messages']
    for (let i = 0; i < msgs.length; ++i) {
        const m = msgs[i]
        if (m) {
            lastTs = m.ts
            if (m.subtype === 'tombstone' || m.subtype === 'channel_join') continue
            const attrs = new Map().set('id', m.client_msg_id).set('ts', `${m.ts}`).set('text', m.text)
            const inst = agentlang.makeInstance('slack', 'Message', attrs)
            await resolver.onSubscription(inst, true);
        }
    }
}

async function handleSubsMessages(resolver) {
    console.log('SLACK RESOLVER: Fetching latest messages...');
    await getAndProcessLastMessage(resolver)
}

export async function subsMessages(resolver) {
    const intervalMinutes = parseInt(process.env.SLACK_POLL_INTERVAL_MINUTES);
    if (!intervalMinutes) {
        console.log('SLACK RESOLVER: polling interval not set, exiting subscription')
        return
    }
    await handleSubsMessages(resolver);
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`SLACK RESOLVER: Setting message polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsMessages(resolver);
    }, intervalMs);
}
