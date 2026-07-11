export type TemplateCategory =
  | 'announcement'
  | 'case_study'
  | 'product_update'
  | 'hiring'
  | 'thought_leadership'
  | 'offer'
  | 'event'
  | 'newsletter_share';

export type TemplateTone =
  | 'executive'
  | 'practical'
  | 'warm'
  | 'bold'
  | 'analytical';

export type TemplatePlatform = 'meta' | 'linkedin' | 'reddit' | 'telegram' | 'whatsapp';

export type SocialPostTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  tone: TemplateTone;
  platforms: TemplatePlatform[];
  content: string;
  hashtags: string[];
  ctaUrlPlaceholder?: string;
};

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  announcement: 'Announcement',
  case_study: 'Case Study',
  product_update: 'Product Update',
  hiring: 'Hiring',
  thought_leadership: 'Thought Leadership',
  offer: 'Offer',
  event: 'Event',
  newsletter_share: 'Newsletter / Blog',
};

export const SOCIAL_POST_TEMPLATES: SocialPostTemplate[] = [
  {
    id: 'smb-growth-announcement',
    name: 'Growth Milestone',
    category: 'announcement',
    tone: 'executive',
    platforms: ['linkedin', 'meta', 'telegram'],
    content:
      'We crossed an important milestone this week: {{milestone}}.\n\nFor us, this is not just a number. It is a signal that Indian SMBs are ready for outbound systems that are disciplined, measurable, and built around real conversations.\n\nThe next focus: turning more of that momentum into predictable pipeline.',
    hashtags: ['#B2BMarketing', '#SMBGrowth', '#Outbound'],
    ctaUrlPlaceholder: 'https://obaol.com',
  },
  {
    id: 'campaign-case-study',
    name: 'Campaign Win',
    category: 'case_study',
    tone: 'analytical',
    platforms: ['linkedin', 'telegram'],
    content:
      'A recent campaign reminded us why outbound performance improves when the basics are handled with care.\n\nThe shift was simple: clearer segmentation, cleaner inbox rotation, stronger follow-up timing, and better reply review.\n\nResult: {{result}}.\n\nThe lesson is not to send more. The lesson is to make every send easier to trust.',
    hashtags: ['#OutboundSales', '#EmailMarketing', '#CampaignOps'],
  },
  {
    id: 'operator-product-update',
    name: 'Operator Feature Drop',
    category: 'product_update',
    tone: 'practical',
    platforms: ['linkedin', 'meta', 'telegram', 'whatsapp'],
    content:
      'New in Obaol: {{feature_name}}.\n\nBuilt for operators who need less guessing and more control, this update helps teams move from manual follow-up to a cleaner, more reliable workflow.\n\nUse it when you need to plan, execute, and review outreach without losing context between tools.',
    hashtags: ['#MarketingAutomation', '#SalesOps', '#ProductUpdate'],
    ctaUrlPlaceholder: 'https://obaol.com/dashboard',
  },
  {
    id: 'hiring-growth-operator',
    name: 'Hiring Growth Operator',
    category: 'hiring',
    tone: 'warm',
    platforms: ['linkedin'],
    content:
      'We are looking for someone who enjoys the operating layer of growth: lists, campaigns, replies, testing, reporting, and the small details that make outbound feel reliable.\n\nIf you are comfortable moving between strategy and execution, this role may be a strong fit.\n\nRole: {{role}}\nLocation: {{location}}\nApply: {{apply_link}}',
    hashtags: ['#Hiring', '#GrowthMarketing', '#SalesOps'],
  },
  {
    id: 'founder-thought-leadership',
    name: 'Founder Point Of View',
    category: 'thought_leadership',
    tone: 'bold',
    platforms: ['linkedin', 'reddit'],
    content:
      'Most outbound problems are not copy problems.\n\nThey are system problems.\n\nThe list is too broad. The sender setup is fragile. The follow-up logic is inconsistent. The reply review loop is slow.\n\nBetter copy helps, but better operating discipline compounds.',
    hashtags: ['#B2BSales', '#Outbound', '#FounderNotes'],
  },
  {
    id: 'limited-consultation-offer',
    name: 'Consultation Offer',
    category: 'offer',
    tone: 'executive',
    platforms: ['linkedin', 'meta', 'telegram', 'whatsapp'],
    content:
      'We are opening a small batch of outbound workflow reviews for SMB teams this month.\n\nWe will look at list quality, sender health, campaign structure, reply handling, and where automation can remove manual drag.\n\nBest fit: teams already sending, but not getting predictable replies.',
    hashtags: ['#SMBMarketing', '#LeadGeneration', '#GrowthOps'],
    ctaUrlPlaceholder: 'https://obaol.com/contact',
  },
  {
    id: 'webinar-event-invite',
    name: 'Live Session Invite',
    category: 'event',
    tone: 'practical',
    platforms: ['linkedin', 'meta', 'telegram'],
    content:
      'Join us for a practical session on building outbound workflows that do not fall apart after the first campaign.\n\nWe will cover sender setup, campaign timing, lead ownership, reply review, and the metrics that actually help operators improve.\n\nDate: {{date}}\nTime: {{time}}',
    hashtags: ['#Webinar', '#OutboundMarketing', '#SalesOps'],
    ctaUrlPlaceholder: 'https://obaol.com/events',
  },
  {
    id: 'newsletter-playbook-share',
    name: 'Playbook Share',
    category: 'newsletter_share',
    tone: 'analytical',
    platforms: ['linkedin', 'telegram', 'whatsapp'],
    content:
      'We published a practical playbook for teams trying to make outbound more predictable.\n\nInside: how to structure campaigns, avoid common sender mistakes, improve follow-up timing, and review replies without slowing down the team.\n\nUseful if your current process depends too much on memory and spreadsheets.',
    hashtags: ['#Newsletter', '#OutboundSales', '#MarketingOps'],
    ctaUrlPlaceholder: 'https://obaol.com/blog',
  },
];
