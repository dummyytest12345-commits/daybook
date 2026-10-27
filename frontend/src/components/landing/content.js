import { BRAND } from '../../brand'

export const FAQ = [
  {
    q: `What is ${BRAND.name}?`,
    a: `${BRAND.name} is a personal work diary and task log. You note what you worked on each day, see progress by day, week and month, and export a clean Excel, PDF or CSV report for your manager or timesheet in one click.`,
  },
  {
    q: 'Do I have to use projects?',
    a: 'No. Projects are optional. Tasks without a project live in your personal log. You can create a project later and move existing tasks into it, or move them back out, at any time. Nothing you logged before is lost or changed.',
  },
  {
    q: 'Where is my data stored? Is it private?',
    a: 'Everything is stored in your own browser (localStorage). There is no server, tracking or ad network. Each account on the same browser keeps its data fully separate, and you can download a full JSON backup at any time.',
  },
  {
    q: 'Does it work offline?',
    a: `Yes. ${BRAND.name} is an installable progressive web app, so it loads and works without a connection once it has been opened.`,
  },
  {
    q: 'Can I import my existing spreadsheet?',
    a: 'Yes. Import CSV or Excel files with a guided column-mapping step and a preview that lists any bad rows. You can also paste legacy notes such as "15 (responsive) Working" and they become tasks with tickets and statuses.',
  },
  {
    q: 'What reports can I export?',
    a: 'Excel workbooks with several sheets and real SUM formulas, A4 PDFs with charts, CSV files that open correctly in Excel, and Markdown or plain text that you can paste into Slack or email. There is also a standup generator.',
  },
  {
    q: 'How do projects work with boards and WIP limits?',
    a: 'Each project has a short key, so tasks are numbered like WEB-12. A project page shows overview charts, a grouped list and a Kanban board where you can set work-in-progress limits per column. Columns turn red when they hold too many cards.',
  },
  {
    q: 'Is there a password reset?',
    a: 'Accounts are stored on your device only, so there is no email reset. Keep a backup from Import/Export. A hosted sync version is planned on top of the same data model.',
  },
]

export const FEATURES = [
  { icon: 'bolt', title: 'Log in five seconds', text: 'One line understands dates, hours, #module, !priority, ~project and due dates. Keyboard only.' },
  { icon: 'log', title: 'Five ways to look', text: 'Day, week, month, board and table views, each one click away. Filters live in the URL.' },
  { icon: 'projects', title: 'Projects, only if you want them', text: 'Keys like WEB-12, boards with WIP limits, and moving tasks between projects at any time.' },
  { icon: 'thread', title: 'Nothing gets lost', text: 'Unfinished tasks carry to the next day as a thread, so you can finish them later and keep the history.' },
  { icon: 'analytics', title: 'Analytics that explain', text: 'KPIs, heatmap, burn-up and plain-English insights. Click a bar to filter everything.' },
  { icon: 'reports', title: 'Reports in one click', text: 'Excel with formulas, PDF with charts, CSV, Markdown for Slack, and a standup generator.' },
]

export const STEPS = [
  { n: '1', title: 'Log as you go', text: 'Type a line, press Enter. Dates, hours and projects are parsed for you.' },
  { n: '2', title: 'Review any period', text: 'Jump between day, week, month, board and table. Filter by project, status or tag.' },
  { n: '3', title: 'Send the report', text: 'Pick a template and format. Preview it live, then download or copy.' },
]

export const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')

export const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND.name,
    url: `${SITE_URL}/`,
    description: BRAND.description,
    inLanguage: 'en',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icons/icon-512.png`,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Any (web browser)',
    description: BRAND.description,
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/og-image.png`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: FEATURES.map((f) => f.title),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` }],
  },
]
