import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, connectSocket, hasDb, makeUser, startTestServer, stopTestServer, waitFor } from './helpers.js'
import { outbox } from '../src/services/email.js'
import { addedToProject, esc, inviteNewUser } from '../src/templates/emailTemplates.js'

const mailTo = (email) => outbox.filter((m) => m.to === email)

describe('email templates', () => {
  it('escape every dynamic value and include a plain-text version and the link', () => {
    const t = inviteNewUser({ email: 'a@b.co', by: '<script>alert(1)</script>', project: { id: 'p1', name: 'Q&A "Team"', key: 'QA', color: '#ff0000' }, role: 'editor', token: 'tok123' })
    expect(t.html).not.toContain('<script>')
    expect(t.html).toContain('&lt;script&gt;')
    expect(t.html).toContain('Q&amp;A &quot;Team&quot;')
    expect(t.html).toContain('/join?invite=tok123&amp;email=a%40b.co')
    expect(t.text).toContain('tok123')
    expect(t.subject).toContain('invited you')
    expect(inviteNewUser({ email: 'a@b.co', by: 'X', project: { id: 'p', name: 'P', key: 'PP' }, role: 'viewer', token: 't', reminder: true }).subject).toMatch(/^Reminder:/)
    const a = addedToProject({ toName: 'Sam Lee', by: 'Ann', project: { id: 'p1', name: 'Site', key: 'WEB' }, role: 'editor' })
    expect(a.html).toContain('You&#8217;re on the team'.replace('&#8217;', '’'))
    expect(a.html).toContain('/team/p1')
    expect(esc(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;')
  })
})

const run = hasDb ? describe : describe.skip

run('collaboration (team projects, invites, progress, chat) on Atlas', () => {
  beforeAll(() => startTestServer())
  afterAll(() => stopTestServer())

  const post = (u, path, body) => api().post(`/api/team${path}`).set(u.h).send(body)
  const get = (u, path) => api().get(`/api/team${path}`).set(u.h)

  async function setup() {
    const owner = await makeUser('owner')
    const proj = (await post(owner, '/projects', { name: 'Website Redesign' })).body.project
    return { owner, proj }
  }

  it('creates a project owned by the creator; non-members cannot see it', async () => {
    const { owner, proj } = await setup()
    expect(proj).toMatchObject({ key: 'WR', ownerId: owner.user.id })
    expect(proj.members).toEqual([expect.objectContaining({ userId: owner.user.id, role: 'owner' })])
    const stranger = await makeUser('stranger')
    expect((await get(stranger, `/projects/${proj.id}`)).status).toBe(404)
    expect((await get(stranger, `/projects/${proj.id}/tasks`)).status).toBe(404)
    expect((await post(stranger, `/projects/${proj.id}/messages`, { text: 'hi' })).status).toBe(404)
    expect((await get(stranger, '/projects')).body.projects).toHaveLength(0)
    expect((await get(owner, '/projects')).body.projects[0]).toMatchObject({ myRole: 'owner', memberCount: 1 })
    expect((await api().get('/api/team/projects')).status).toBe(401)
  })

  it('search tells whether an email has an account and whether they are already in the project', async () => {
    const { owner, proj } = await setup()
    const bob = await makeUser('bob')
    const found = (await get(owner, `/users/search?email=${encodeURIComponent(bob.email.toUpperCase())}&projectId=${proj.id}`)).body
    expect(found).toMatchObject({ exists: true, state: 'none', user: { name: 'bob Tester' } })
    const none = (await get(owner, `/users/search?email=ghost.${Date.now()}@example.com`)).body
    expect(none).toMatchObject({ exists: false, user: null })
    expect((await get(owner, '/users/search?email=not-an-email')).status).toBe(400)
    await post(owner, `/projects/${proj.id}/members`, { email: bob.email })
    expect((await get(owner, `/users/search?email=${encodeURIComponent(bob.email)}&projectId=${proj.id}`)).body.state).toBe('member')
  })

  it('existing user: added immediately, gets a notification and the "you were added" email', async () => {
    const { owner, proj } = await setup()
    const bob = await makeUser('bob')
    const before = mailTo(bob.email).length
    const r = await post(owner, `/projects/${proj.id}/members`, { email: bob.email, role: 'viewer' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ result: 'added', member: { role: 'viewer' }, email: { sent: true } })
    const mail = mailTo(bob.email).slice(before)
    expect(mail).toHaveLength(1)
    expect(mail[0].subject).toContain('added you to')
    expect(mail[0].html).toContain(`/team/${proj.id}`)
    expect(mail[0].html).toContain('Website Redesign')
    expect(mail[0].text).toContain('Open the project')
    const notes = (await get(bob, '/notifications')).body
    expect(notes.unread).toBe(1)
    expect(notes.notifications[0]).toMatchObject({ type: 'added', link: `/team/${proj.id}` })
    expect((await post(bob, '/notifications/read', { all: true })).body.unread).toBe(0)
    expect((await get(bob, '/projects')).body.projects).toHaveLength(1)
    // adding again, or adding yourself, is handled
    expect((await post(owner, `/projects/${proj.id}/members`, { email: bob.email })).body.result).toBe('already_member')
    expect((await post(owner, `/projects/${proj.id}/members`, { email: owner.email })).status).toBe(400)
  })

  it('unknown email: invitation email now, joins automatically when they register', async () => {
    const { owner, proj } = await setup()
    const email = `newbie.${Date.now()}@example.com`
    const r = await post(owner, `/projects/${proj.id}/members`, { email, role: 'editor' })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ result: 'invited', email: { sent: true } })
    expect(r.body.invite.token).toBeUndefined() // the secret is only in the email
    const mail = mailTo(email)
    expect(mail).toHaveLength(1)
    expect(mail[0].subject).toContain('invited you')
    const token = /invite=([a-f0-9]+)&amp;/.exec(mail[0].html)[1]
    expect((await post(owner, `/projects/${proj.id}/members`, { email })).body.result).toBe('already_invited')
    // the public preview shows what they are joining, without logging in
    const preview = (await api().get(`/api/team/invites/${token}`)).body
    expect(preview).toMatchObject({ email, invitedBy: 'owner Tester', accountExists: false, project: { name: 'Website Redesign' } })
    expect((await api().get('/api/team/invites/nonsense')).status).toBe(404)
    // pending list for the owner
    const pending = (await get(owner, `/projects/${proj.id}`)).body.invites
    expect(pending).toHaveLength(1)
    // registering with that email auto-joins
    const reg = await api().post('/api/auth/register').send({ name: 'New Person', email, password: 'Passw0rd!x' })
    expect(reg.body.joinedProjects).toEqual([{ id: proj.id, name: 'Website Redesign' }])
    const h = { Authorization: `Bearer ${reg.body.token}` }
    expect((await api().get('/api/team/projects').set(h)).body.projects).toHaveLength(1)
    expect((await get(owner, `/projects/${proj.id}`)).body.invites).toHaveLength(0)
    expect((await get(owner, '/notifications')).body.notifications[0]).toMatchObject({ type: 'accepted' })
    expect((await api().get(`/api/team/invites/${token}`)).status).toBe(404) // used
  })

  it('resend and revoke invitations; a revoked invite does not join', async () => {
    const { owner, proj } = await setup()
    const email = `later.${Date.now()}@example.com`
    const inv = (await post(owner, `/projects/${proj.id}/members`, { email })).body.invite
    const re = await post(owner, `/projects/${proj.id}/invites/${inv.id}/resend`, {})
    expect(re.body.invite.sentCount).toBe(2)
    expect(mailTo(email).at(-1).subject).toMatch(/^Reminder:/)
    expect((await api().delete(`/api/team/projects/${proj.id}/invites/${inv.id}`).set(owner.h)).status).toBe(204)
    const reg = await api().post('/api/auth/register').send({ name: 'Late Person', email, password: 'Passw0rd!x' })
    expect(reg.body.joinedProjects).toEqual([])
  })

  it('roles: viewers can chat but not change tasks; only the owner removes members or changes roles', async () => {
    const { owner, proj } = await setup()
    const ed = await makeUser('editor')
    const vw = await makeUser('viewer')
    await post(owner, `/projects/${proj.id}/members`, { email: ed.email, role: 'editor' })
    await post(owner, `/projects/${proj.id}/members`, { email: vw.email, role: 'viewer' })
    expect((await post(vw, `/projects/${proj.id}/tasks`, { title: 'nope' })).status).toBe(403)
    expect((await post(vw, `/projects/${proj.id}/messages`, { text: 'viewers can talk' })).status).toBe(201)
    expect((await post(ed, `/projects/${proj.id}/tasks`, { title: 'Editor task' })).status).toBe(201)
    expect((await api().delete(`/api/team/projects/${proj.id}/members/${vw.user.id}`).set(ed.h)).status).toBe(403)
    expect((await api().patch(`/api/team/projects/${proj.id}/members/${vw.user.id}`).set(ed.h).send({ role: 'editor' })).status).toBe(403)
    expect((await api().patch(`/api/team/projects/${proj.id}/members/${vw.user.id}`).set(owner.h).send({ role: 'editor' })).body.member.role).toBe('editor')
    expect((await api().delete(`/api/team/projects/${proj.id}/members/${owner.user.id}`).set(owner.h)).status).toBe(400) // owner can't leave
    expect((await api().patch(`/api/team/projects/${proj.id}`).set(ed.h).send({ name: 'Hijack' })).status).toBe(403)
    // anyone can leave
    expect((await api().delete(`/api/team/projects/${proj.id}/members/${ed.user.id}`).set(ed.h)).status).toBe(200)
    expect((await get(ed, `/projects/${proj.id}`)).status).toBe(404)
    expect((await api().delete(`/api/team/projects/${proj.id}/members/${vw.user.id}`).set(owner.h)).status).toBe(200)
  })

  it('assignees add their own progress; overall progress is the mean; status follows the 0% / 100% rules', async () => {
    const { owner, proj } = await setup()
    const ann = await makeUser('ann')
    const ben = await makeUser('ben')
    for (const u of [ann, ben]) await post(owner, `/projects/${proj.id}/members`, { email: u.email })
    const task = (await post(owner, `/projects/${proj.id}/tasks`, { title: 'Build landing page', assignees: [ann.user.id, ben.user.id] })).body.task
    expect(task).toMatchObject({ number: 1, status: 'pending', progress: 0 })
    expect((await post(owner, `/projects/${proj.id}/tasks`, { title: 'Bad', assignees: ['not-a-member'] })).status).toBe(400)
    const mine = (u, body) => api().put(`/api/team/tasks/${task.id}/my-progress`).set(u.h).send(body)

    let t = (await mine(ann, { progress: 60, note: 'hero done' })).body.task
    expect(t).toMatchObject({ progress: 30, status: 'in_progress' }) // (60 + 0) / 2
    expect(t.contributions.find((c) => c.userId === ann.user.id)).toMatchObject({ progress: 60, note: 'hero done' })
    t = (await mine(ben, { progress: 20 })).body.task
    expect(t.progress).toBe(40) // (60 + 20) / 2
    expect((await mine(owner, { progress: 50 })).status).toBe(403) // not assigned
    expect((await mine(ann, { progress: 101 })).status).toBe(400)
    t = (await mine(ann, { progress: 100 })).body.task
    t = (await mine(ben, { progress: 100 })).body.task
    expect(t).toMatchObject({ progress: 100, status: 'completed' })
    expect(t.completedAt).toBeTruthy()
    // others are told it completed
    expect((await get(owner, '/notifications')).body.notifications.some((n) => n.type === 'completed')).toBe(true)
    // lowering reopens
    t = (await mine(ben, { progress: 50 })).body.task
    expect(t).toMatchObject({ progress: 75, status: 'in_progress', completedAt: null })

    const stats = (await get(owner, `/projects/${proj.id}`)).body.stats
    expect(stats).toMatchObject({ total: 1, avgProgress: 75 })
    expect(stats.members.find((m) => m.userId === ann.user.id)).toMatchObject({ assigned: 1, avgProgress: 100, finished: 1 })
    expect(stats.members.find((m) => m.userId === ben.user.id)).toMatchObject({ avgProgress: 50 })
    const list = (await get(owner, '/projects')).body.projects[0]
    expect(list.stats).toMatchObject({ total: 1, avgProgress: 75 })
  })

  it('unassigned tasks: a first contributor claims it; assignee changes recompute progress; removing a member removes their share', async () => {
    const { owner, proj } = await setup()
    const ann = await makeUser('ann')
    const ben = await makeUser('ben')
    for (const u of [ann, ben]) await post(owner, `/projects/${proj.id}/members`, { email: u.email })
    const task = (await post(owner, `/projects/${proj.id}/tasks`, { title: 'Open task' })).body.task
    const t1 = (await api().put(`/api/team/tasks/${task.id}/my-progress`).set(ann.h).send({ progress: 40 })).body.task
    expect(t1).toMatchObject({ assignees: [ann.user.id], progress: 40, status: 'in_progress' })
    const t2 = (await api().patch(`/api/team/tasks/${task.id}`).set(owner.h).send({ assignees: [ann.user.id, ben.user.id] })).body.task
    expect(t2.progress).toBe(20)
    expect((await api().get(`/api/notifications`).set(ben.h)).status).toBe(404)
    expect((await get(ben, '/notifications')).body.notifications.some((n) => n.type === 'assigned')).toBe(true)
    await api().delete(`/api/team/projects/${proj.id}/members/${ben.user.id}`).set(owner.h)
    const after = (await get(owner, `/projects/${proj.id}/tasks`)).body.tasks[0]
    expect(after).toMatchObject({ assignees: [ann.user.id], progress: 40 })
    // direct edits on an unassigned task use the overall progress rules
    const free = (await post(owner, `/projects/${proj.id}/tasks`, { title: 'Solo' })).body.task
    expect((await api().patch(`/api/team/tasks/${free.id}`).set(owner.h).send({ progress: 70 })).body.task).toMatchObject({ progress: 70, status: 'in_progress' })
    expect((await api().patch(`/api/team/tasks/${free.id}`).set(owner.h).send({ status: 'blocked' })).body.task.status).toBe('blocked')
    expect((await api().delete(`/api/team/tasks/${free.id}`).set(owner.h)).status).toBe(204)
    expect((await get(owner, `/projects/${proj.id}/tasks`)).body.tasks).toHaveLength(1)
  })

  it('chat: messages, task threads, history paging, edit/delete rules, reactions, mentions, unread, system lines', async () => {
    const { owner, proj } = await setup()
    const ann = await makeUser('ann')
    await post(owner, `/projects/${proj.id}/members`, { email: ann.email })
    const task = (await post(owner, `/projects/${proj.id}/tasks`, { title: 'Chatty task', assignees: [ann.user.id] })).body.task

    expect((await post(owner, `/projects/${proj.id}/messages`, { text: '   ' })).status).toBe(400)
    const m1 = (await post(owner, `/projects/${proj.id}/messages`, { text: 'Hello team' })).body.message
    expect(m1).toMatchObject({ text: 'Hello team', author: 'owner Tester', type: 'user' })
    await post(owner, `/projects/${proj.id}/messages`, { text: 'Task question', taskId: task.id })
    expect((await post(owner, `/projects/${proj.id}/messages`, { text: 'x', taskId: 'other' })).status).toBe(400)
    // mention
    await post(owner, `/projects/${proj.id}/messages`, { text: 'Can you check this @ann ?' })
    expect((await get(ann, '/notifications')).body.notifications.some((n) => n.type === 'mention')).toBe(true)
    // unread count for ann, cleared by marking read
    expect((await get(ann, '/projects')).body.projects[0].unread).toBe(3)
    await post(ann, `/projects/${proj.id}/read`, {})
    expect((await get(ann, '/projects')).body.projects[0].unread).toBe(0)
    // main chat vs task thread
    const main = (await get(ann, `/projects/${proj.id}/messages`)).body.messages
    expect(main.some((m) => m.text === 'Task question')).toBe(false) // task conversations stay in the task
    expect(main.some((m) => m.type === 'system' && /created WR-1/.test(m.text))).toBe(true) // activity shows in main chat
    const th = (await get(ann, `/projects/${proj.id}/messages?taskId=${task.id}`)).body.messages
    expect(th.map((m) => m.text)).toContain('Task question')
    // progress writes a system line into the task thread
    await api().put(`/api/team/tasks/${task.id}/my-progress`).set(ann.h).send({ progress: 30, note: 'started' })
    const th2 = (await get(ann, `/projects/${proj.id}/messages?taskId=${task.id}`)).body.messages
    expect(th2.at(-1)).toMatchObject({ type: 'system', text: expect.stringContaining('set progress to 30% on WR-1: started'), meta: { progress: 30, overall: 30 } })
    // paging
    for (let i = 0; i < 5; i++) await post(ann, `/projects/${proj.id}/messages`, { text: `m${i}` })
    const page = (await get(ann, `/projects/${proj.id}/messages?limit=3`)).body
    expect(page.messages).toHaveLength(3)
    expect(page.hasMore).toBe(true)
    const older = (await get(ann, `/projects/${proj.id}/messages?limit=3&before=${encodeURIComponent(page.messages[0].createdAt)}`)).body
    expect(older.messages.every((m) => m.createdAt < page.messages[0].createdAt)).toBe(true)
    // edit / delete rules
    const mine = (await post(ann, `/projects/${proj.id}/messages`, { text: 'typo' })).body.message
    expect((await api().patch(`/api/team/messages/${mine.id}`).set(owner.h).send({ text: 'hack' })).status).toBe(403)
    const ed = (await api().patch(`/api/team/messages/${mine.id}`).set(ann.h).send({ text: 'fixed' })).body.message
    expect(ed).toMatchObject({ text: 'fixed' })
    expect(ed.editedAt).toBeTruthy()
    // reactions toggle
    const r1 = (await api().post(`/api/team/messages/${mine.id}/reactions`).set(owner.h).send({ emoji: '👍' })).body.message
    expect(r1.reactions).toEqual([{ emoji: '👍', userIds: [owner.user.id] }])
    expect((await api().post(`/api/team/messages/${mine.id}/reactions`).set(owner.h).send({ emoji: '👍' })).body.message.reactions).toEqual([])
    // the owner may delete anyone's message; deleted text is blanked
    expect((await api().delete(`/api/team/messages/${mine.id}`).set(owner.h)).status).toBe(204)
    const tomb = (await get(owner, `/projects/${proj.id}/messages?limit=100`)).body.messages.find((m) => m.id === mine.id)
    expect(tomb).toMatchObject({ text: '' }) // a blank tombstone, so the conversation order is kept
    expect(tomb.deletedAt).toBeTruthy()
    expect((await api().patch(`/api/team/messages/${mine.id}`).set(ann.h).send({ text: 'again' })).status).toBe(404)
  })

  it('real-time: join checks membership; messages, progress, typing and presence reach the room', async () => {
    const { owner, proj } = await setup()
    const ann = await makeUser('ann')
    const outsider = await makeUser('out')
    await post(owner, `/projects/${proj.id}/members`, { email: ann.email })
    const task = (await post(owner, `/projects/${proj.id}/tasks`, { title: 'Live task', assignees: [ann.user.id] })).body.task

    const a = await connectSocket(owner.token)
    const b = await connectSocket(ann.token)
    const o = await connectSocket(outsider.token)
    const join = (s) => new Promise((res) => s.socket.emit('team:join', { projectId: proj.id }, res))
    expect((await join(o)).ok).toBe(false)
    expect((await join(a)).ok).toBe(true)
    const presence = waitFor(a.socket, 'team:presence')
    expect((await join(b)).online.sort()).toEqual([owner.user.id, ann.user.id].sort())
    expect((await presence).online).toContain(ann.user.id)

    let leaked = false
    ;['chat:message', 'team:changes', 'chat:typing'].forEach((e) => o.socket.on(e, () => (leaked = true)))

    const msg = waitFor(b.socket, 'chat:message')
    await post(owner, `/projects/${proj.id}/messages`, { text: 'live hello' })
    expect(await msg).toMatchObject({ text: 'live hello', userId: owner.user.id })

    const change = waitFor(a.socket, 'team:changes')
    await api().put(`/api/team/tasks/${task.id}/my-progress`).set(ann.h).send({ progress: 80 })
    expect(await change).toMatchObject({ projectId: proj.id, tasksChanged: true, task: { progress: 80, status: 'in_progress' } })

    const typing = waitFor(a.socket, 'chat:typing')
    b.socket.emit('chat:typing', { projectId: proj.id, typing: true })
    expect(await typing).toMatchObject({ userId: ann.user.id, name: 'ann Tester', typing: true })
    o.socket.emit('chat:typing', { projectId: proj.id, typing: true }) // not joined: ignored

    // a new member's other devices are told their project list changed
    const carl = await makeUser('carl')
    const carlSock = await connectSocket(carl.token)
    const changed = waitFor(carlSock.socket, 'team:projects-changed')
    const note = waitFor(carlSock.socket, 'notification')
    await post(owner, `/projects/${proj.id}/members`, { email: carl.email })
    expect(await changed).toMatchObject({ projectId: proj.id })
    expect(await note).toMatchObject({ type: 'added' })

    const gone = waitFor(a.socket, 'team:presence')
    b.socket.close()
    expect((await gone).online).not.toContain(ann.user.id)
    await new Promise((r) => setTimeout(r, 200))
    expect(leaked).toBe(false)
    ;[a, o, carlSock].forEach((s) => s.socket.close())
  })

  it('deleting a project hides it; accounts deleted later show as former members', async () => {
    const { owner, proj } = await setup()
    const ann = await makeUser('ann')
    await post(owner, `/projects/${proj.id}/members`, { email: ann.email })
    expect((await api().delete(`/api/team/projects/${proj.id}`).set(ann.h)).status).toBe(403)
    await api().delete('/api/auth/me').set(ann.h).send({ password: ann.password })
    const members = (await get(owner, `/projects/${proj.id}`)).body.members
    expect(members.find((m) => m.userId === ann.user.id).name).toBe('Former member')
    expect((await api().delete(`/api/team/projects/${proj.id}`).set(owner.h)).status).toBe(204)
    expect((await get(owner, `/projects/${proj.id}`)).status).toBe(404)
    expect((await get(owner, '/projects')).body.projects).toHaveLength(0)
  })
})
