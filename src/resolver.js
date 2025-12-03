const al_api = await import(`${process.cwd()}/node_modules/agentlang/out/runtime/api.js`);

const makeInstance = al_api.makeInstance;

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

async function getAndProcessLastMessage(resolver) {
    const ts = lastTs
    const apiUrl = getUrl(`conversations.history?channel=${getChannel()}&oldest=${ts}&limit=1&inclusive=false`)
    const resp = await handleFetch(apiUrl, {
        method: 'GET',
        headers: StandardHeaders()
    });
    const m = resp['messages'][0]
    if (m) {
        lastTs = m.ts
        const attrs = new Map().set('id', m.client_msg_id).set('ts', m.ts).set('text', m.text)
        const inst = makeInstance('slack', 'Message', attrs)
        await resolver.onSubscription(inst, true);
    }
}

async function handleSubsMessages(resolver) {
    console.log('SLACK RESOLVER: Fetching latest messages...');
    await getAndProcessLastMessage(resolver)
}

export async function subsMessages(resolver) {
    const intervalMinutes = parseInt(process.env.SLACK_POLL_INTERVAL_MINUTES);
    if (!intervalMinutes) {
        console.log('SLACK RESOILVER: polling interval not set, exiting subscription')
        return
    }
    await handleSubsMessages(resolver);
    const intervalMs = intervalMinutes * 60 * 1000;
    console.log(`SLACK RESOLVER: Setting message polling interval to ${intervalMinutes} minutes`);
    setInterval(async () => {
        await handleSubsMessages(resolver);
    }, intervalMs);
}
