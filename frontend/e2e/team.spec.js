import { expect, test } from '@playwright/test'
import { apiRegister, latestMailTo, signUp } from './helpers.js'

/** Connect the signed-in local account to Daybook Cloud by creating a cloud account (same email). */
async function connectCloud(page) {
  await page.goto('/team') // signing in already connects teams
  await expect(page.getByRole('button', { name: 'New team project' })).toBeVisible()
}

test('team: invite a new person by email, they register and join; per-member progress and chat are live', async ({ browser, request }) => {
  const errors = []
  const alicePage = await (await browser.newContext()).newPage()
  alicePage.on('pageerror', (e) => errors.push(e.message))

  // --- Alice: local account, cloud account, project
  await signUp(alicePage, 'Alice Owner')
  await connectCloud(alicePage)
  await alicePage.getByRole('button', { name: 'New team project' }).click()
  await alicePage.getByLabel('Name *').fill('Launch Plan')
  await alicePage.getByRole('button', { name: 'Create project' }).click()
  await expect(alicePage.getByRole('heading', { name: /Launch Plan/ })).toBeVisible()

  // --- search an email that has NO account: tells her, then sends an invitation email
  const bobEmail = `bob.${Date.now()}@example.com`
  await alicePage.getByRole('tab', { name: /People/ }).click()
  await alicePage.getByLabel('Teammate email').fill(bobEmail)
  await expect(alicePage.getByText(`No account for ${bobEmail}`)).toBeVisible()
  await alicePage.getByRole('button', { name: 'Send invitation' }).click()
  await expect(alicePage.getByText(`Invitation sent to ${bobEmail}`)).toBeVisible()
  await expect(alicePage.getByRole('heading', { name: 'Pending invitations' })).toBeVisible()

  // --- the email: branded template with a join link
  const mail = await latestMailTo(bobEmail)
  expect(mail.html).toContain('Alice Owner')
  expect(mail.html).toContain('Launch Plan')
  expect(mail.text).toContain('/join?invite=')
  const link = /(http:\/\/localhost:4173\/join\?invite=[a-f0-9]+&email=[^\s"<]+)/.exec(mail.text)[1]

  // --- Bob opens the link, sees the invitation, creates the account and lands in the project
  const bobPage = await (await browser.newContext()).newPage()
  bobPage.on('pageerror', (e) => errors.push(e.message))
  await bobPage.goto(link)
  await expect(bobPage.getByText('Alice Owner')).toBeVisible()
  await expect(bobPage.getByText('Launch Plan')).toBeVisible()
  await expect(bobPage.getByLabel('Email')).toHaveValue(bobEmail)
  await bobPage.getByLabel('Your name').fill('Bob Invited')
  await bobPage.getByLabel('Choose a password').fill('Passw0rd!x')
  await bobPage.getByRole('button', { name: 'Create account and join' }).click()
  await expect(bobPage.getByRole('heading', { name: /Launch Plan/ })).toBeVisible()

  // --- Alice sees Bob join without reloading (real time)
  await expect(alicePage.getByText('Bob Invited').first()).toBeVisible()
  await expect(alicePage.getByRole('heading', { name: 'Pending invitations' })).toHaveCount(0)

  // --- Alice creates a task assigned to both
  await alicePage.getByRole('tab', { name: /Tasks/ }).click()
  await alicePage.getByLabel('New task title').fill('Build landing page')
  await alicePage.getByRole('button', { name: 'Assign' }).click()
  await alicePage.getByRole('menuitem', { name: 'Alice Owner' }).click()
  await alicePage.keyboard.press('Escape')
  await alicePage.getByRole('button', { name: /1 assigned/ }).click()
  await alicePage.getByRole('menuitem', { name: 'Bob Invited' }).click()
  await alicePage.keyboard.press('Escape')
  await alicePage.getByRole('button', { name: 'Add task', exact: true }).click()
  await expect(alicePage.getByRole('article', { name: 'Build landing page' })).toBeVisible()

  // --- Bob adds HIS progress with a note; Alice sees the overall change live
  await expect(bobPage.getByRole('article', { name: 'Build landing page' })).toBeVisible()
  await bobPage.getByRole('button', { name: 'Update my progress' }).click()
  await bobPage.getByRole('button', { name: '50%', exact: true }).click()
  await bobPage.getByLabel('Add a note (optional)').fill('hero section done')
  await bobPage.getByRole('button', { name: 'Save progress' }).click()
  const aliceCard = alicePage.getByRole('article', { name: 'Build landing page' })
  await expect(aliceCard.getByRole('img', { name: '25 percent' })).toBeVisible() // (50 + 0) / 2
  await expect(aliceCard.getByText('50%')).toBeVisible()

  // --- Alice adds hers: 100 -> overall 75
  await aliceCard.getByRole('button', { name: 'Update my progress' }).click()
  await alicePage.getByRole('button', { name: '100%', exact: true }).click()
  await alicePage.getByRole('button', { name: 'Save progress' }).click()
  await expect(aliceCard.getByRole('img', { name: '75 percent' })).toBeVisible()
  await expect(bobPage.getByRole('article', { name: 'Build landing page' }).getByRole('img', { name: '75 percent' })).toBeVisible()

  // --- chat: live both ways, with the progress note as a system line
  await alicePage.getByRole('tab', { name: 'Chat' }).click()
  await bobPage.getByRole('tab', { name: 'Chat' }).click()
  await expect(bobPage.getByText(/set progress to 50% on LP-1: hero section done/)).toBeVisible()
  await alicePage.getByLabel('Message the team').fill('Great work Bob!')
  await alicePage.keyboard.press('Enter')
  await expect(bobPage.getByText('Great work Bob!')).toBeVisible()
  await bobPage.getByLabel('Message the team').fill('Thanks! @Alice')
  await bobPage.keyboard.press('Enter')
  await expect(alicePage.getByText('Thanks!')).toBeVisible()
  expect(errors, errors.join('\n')).toHaveLength(0)
})

test('team: an existing user is found by email, added instantly, notified live and emailed', async ({ browser, request }) => {
  const carlEmail = `carl.${Date.now()}@example.com`
  await apiRegister(request, 'Carl Existing', carlEmail)

  // Carl has a local + cloud account and is online, so the notification arrives live
  const carl = await (await browser.newContext()).newPage()
  await carl.goto('/login')
  await carl.getByLabel('Email').fill(carlEmail)
  await carl.getByLabel('Password', { exact: true }).fill('Passw0rd!x')
  await carl.getByRole('button', { name: 'Sign in' }).click()
  await expect(carl.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible()
  await carl.goto('/team')
  await expect(carl.getByRole('button', { name: 'New team project' })).toBeVisible()

  const dana = await (await browser.newContext()).newPage()
  await signUp(dana, 'Dana Owner')
  await connectCloud(dana)
  await dana.getByRole('button', { name: 'New team project' }).click()
  await dana.getByLabel('Name *').fill('Existing Users')
  await dana.getByRole('button', { name: 'Create project' }).click()
  await dana.getByRole('tab', { name: /People/ }).click()
  await dana.getByLabel('Teammate email').fill(carlEmail)
  await expect(dana.getByText('Carl Existing')).toBeVisible()
  await expect(dana.getByText('has a Daybook account')).toBeVisible()
  await dana.getByRole('button', { name: 'Add to project' }).click()
  await expect(dana.getByText('Carl Existing was added')).toBeVisible()

  // live notification + the project appears in his list
  await expect(carl.getByRole('button', { name: /Notifications, 1 unread/ })).toBeVisible()
  await expect(carl.getByRole('link', { name: /Existing Users/ })).toBeVisible()
  await carl.getByRole('button', { name: /Notifications/ }).click()
  await expect(carl.getByRole('button', { name: /Dana Owner added you to Existing Users/ })).toBeVisible()

  // the "you were added" email
  const mail = await latestMailTo(carlEmail)
  expect(mail.html).toContain('added you to')
  expect(mail.html).toContain('Existing Users')
})

test('team: viewers cannot edit, and the join link of a used invitation is refused', async ({ browser, request }) => {
  const email = `viewer.${Date.now()}@example.com`
  const owner = await (await browser.newContext()).newPage()
  await signUp(owner, 'Olga Owner')
  await connectCloud(owner)
  await owner.getByRole('button', { name: 'New team project' }).click()
  await owner.getByLabel('Name *').fill('Read Only Club')
  await owner.getByRole('button', { name: 'Create project' }).click()
  await owner.getByRole('tab', { name: /People/ }).click()
  await owner.getByLabel('Teammate email').fill(email)
  await owner.getByLabel('Role').selectOption('viewer')
  await owner.getByRole('button', { name: 'Send invitation' }).click()
  await expect(owner.getByText(`Invitation sent to ${email}`)).toBeVisible()
  const mail = await latestMailTo(email)
  const link = /(http:\/\/localhost:4173\/join\?invite=[a-f0-9]+&email=[^\s"<]+)/.exec(mail.text)[1]

  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto(link)
  await viewer.getByLabel('Your name').fill('Vic Viewer')
  await viewer.getByLabel('Choose a password').fill('Passw0rd!x')
  await viewer.getByRole('button', { name: 'Create account and join' }).click()
  await expect(viewer.getByRole('heading', { name: /Read Only Club/ })).toBeVisible()
  await expect(viewer.getByLabel('New task title')).toHaveCount(0) // no task form for viewers
  await viewer.getByRole('tab', { name: 'Chat' }).click()
  await viewer.getByLabel('Message the team').fill('Viewers can still chat')
  await viewer.keyboard.press('Enter')
  await expect(owner.getByText('Viewers can still chat')).toHaveCount(0) // owner is on another tab
  await owner.getByRole('tab', { name: 'Chat' }).click()
  await expect(owner.getByText('Viewers can still chat')).toBeVisible()

  // used link
  const again = await (await browser.newContext()).newPage()
  await again.goto(link)
  await expect(again.getByRole('heading', { name: 'Invitation unavailable' })).toBeVisible()
})
