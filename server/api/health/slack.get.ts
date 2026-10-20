export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  if (!config.slackBotToken) {
    throw createError({ statusCode: 503, statusMessage: 'SLACK_BOT_TOKEN is not configured' })
  }

  try {
    const response = await $fetch<{ ok: boolean; error?: string; team?: string; user?: string; bot_id?: string }>('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${config.slackBotToken}` },
    })

    if (!response.ok) {
      throw createError({ statusCode: 502, statusMessage: `Slack authentication failed: ${response.error || 'unknown_error'}` })
    }

    return {
      ok: true,
      service: 'slack',
      team: response.team,
      user: response.user,
      botId: response.bot_id,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[slack-health]', error instanceof Error ? error.message : error)
    throw createError({ statusCode: 503, statusMessage: 'Unable to reach Slack' })
  }
})
