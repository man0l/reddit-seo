import { ReplyStyle, REPLY_STYLES } from './types'

interface TemplateVariables {
  tone: string
  businessDescription: string
  postUrl: string
  postText?: string
  commentsText?: string
  subreddit?: string
  postTitle?: string
}

/**
 * Replaces template variables in the format {{variableName}} with actual values
 */
export function replaceTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  let result = template

  // Replace all variables in the format {{variableName}}
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    // Replace with empty string if value is undefined/null, otherwise use the value
    result = result.replace(regex, value || '')
  })

  // Clean up any extra blank lines that might result from empty variables
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}

/**
 * Builds template variables from the provided data
 */
export function buildTemplateVariables(params: {
  businessDescription: string
  style: ReplyStyle
  postUrl: string
  scraped?: {
    text?: string
    content?: string
    comments?: Array<{ text?: string }>
    title?: string
    subreddit?: string
  } | null
}): TemplateVariables {
  const { businessDescription, style, postUrl, scraped } = params
  const styleConfig = REPLY_STYLES[style]
  const tone = styleConfig.tone
  const postText = scraped?.text || scraped?.content || ''
  
  const commentsText = scraped?.comments && Array.isArray(scraped.comments)
    ? `These are some recent comments from the thread. Use them to tailor the reply (do not quote verbatim, paraphrase where needed):\n- ${scraped.comments.map((c) => c.text || '').filter(Boolean).slice(0, 15).join('\n- ')}`
    : ''

  return {
    tone,
    businessDescription,
    postUrl,
    postText: postText ? `Original post context: ${postText}` : '',
    commentsText,
    subreddit: scraped?.subreddit || '',
    postTitle: scraped?.title || '',
  }
}

