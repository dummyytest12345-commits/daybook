import { beforeEach, describe, expect, it } from 'vitest'
import * as auth from '../services/auth'
import { LocalStorageRepository, userPrefix } from '../services/repository/localStorageRepo'
import { registerSchema, passwordStrength } from '../schemas/auth'
import { T } from './helpers'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

const alice = { name: 'Alice A', email: 'Alice@Example.com', password: 'secret123' }
const bob = { name: 'Bob B', email: 'bob@example.com', password: 'hunter2hunter2' }

describe('accounts', () => {
  it('registers, normalises email, never stores the plain password, starts a session', async () => {
    const { user } = await auth.registerUser(alice)
    expect(user.email).toBe('alice@example.com')
    expect(localStorage.getItem('worklog:v1:users')).not.toContain('secret123')
    expect(auth.currentUser()?.id).toBe(user.id)
  })

  it('rejects duplicate emails and weak passwords', async () => {
    await auth.registerUser(alice)
    await expect(auth.registerUser({ ...alice, email: 'alice@example.com' })).rejects.toMatchObject({ code: 'exists' })
    await expect(auth.registerUser({ ...bob, password: 'short' })).rejects.toThrow()
    await expect(auth.registerUser({ ...bob, password: 'onlyletters' })).rejects.toThrow()
  })

  it('logs in with the right password only', async () => {
    await auth.registerUser(alice)
    auth.clearSession()
    await expect(auth.loginUser({ email: 'alice@example.com', password: 'wrong-pass1' })).rejects.toMatchObject({ code: 'invalid' })
    expect(auth.currentUser()).toBeNull()
    const u = await auth.loginUser({ email: ' ALICE@example.com ', password: 'secret123' })
    expect(u.name).toBe('Alice A')
    expect(auth.currentUser()?.id).toBe(u.id)
  })

  it('locks the email for a while after 5 failed attempts', async () => {
    await auth.registerUser(alice)
    for (let i = 0; i < 5; i++) await auth.loginUser({ email: alice.email, password: 'nope-nope1' }).catch(() => {})
    await expect(auth.loginUser({ email: alice.email, password: 'secret123' })).rejects.toMatchObject({ code: 'locked' })
  })

  it('remember=false keeps the session out of localStorage', async () => {
    await auth.registerUser({ ...alice, remember: false })
    expect(localStorage.getItem('worklog:v1:session')).toBeNull()
    expect(sessionStorage.getItem('worklog:v1:session')).toBeTruthy()
  })

  it('changes password and deletes the account with its data', async () => {
    const { user } = await auth.registerUser(alice)
    await expect(auth.changePassword(user.id, 'bad-current1', 'newpass123')).rejects.toMatchObject({ code: 'invalid' })
    await auth.changePassword(user.id, 'secret123', 'newpass123')
    auth.clearSession()
    await auth.loginUser({ email: alice.email, password: 'newpass123' })

    const repo = new LocalStorageRepository({ userId: user.id, debounceMs: 0 })
    await repo.saveTasks([T()])
    repo.flush()
    expect(localStorage.getItem(`${userPrefix(user.id)}tasks`)).toBeTruthy()
    await auth.deleteAccount(user.id, 'newpass123')
    expect(localStorage.getItem(`${userPrefix(user.id)}tasks`)).toBeNull()
    expect(auth.listUsers()).toHaveLength(0)
    expect(auth.currentUser()).toBeNull()
  })

  it('discards a session that points to a deleted account', async () => {
    await auth.registerUser(alice)
    localStorage.setItem('worklog:v1:users', '[]')
    expect(auth.currentUser()).toBeNull()
  })
})

describe('per-user data separation', () => {
  it('keeps each user’s tasks, settings and snapshots isolated', async () => {
    const a = new LocalStorageRepository({ userId: 'u-a' })
    const b = new LocalStorageRepository({ userId: 'u-b' })
    await a.saveTasks([T({ title: 'Alice task' })])
    await a.saveSettings({ ...(await a.getSettings()), dailyCapacity: 6 })
    a.flush()
    expect(await a.listTasks()).toHaveLength(1)
    expect(await b.listTasks()).toHaveLength(0)
    expect((await b.getSettings()).dailyCapacity).toBe(8)
    await b.saveTasks([T({ title: 'Bob task' })])
    b.flush()
    expect((await a.listTasks())[0].title).toBe('Alice task')
    expect((await b.listTasks())[0].title).toBe('Bob task')
    a.dispose()
    b.dispose()
  })

  it('requires a user id', () => {
    expect(() => new LocalStorageRepository({})).toThrow()
  })

  it('first account adopts pre-accounts data; a second account does not', async () => {
    localStorage.setItem('worklog:v1:tasks', JSON.stringify([T({ title: 'Legacy' })]))
    const { user: first, adopted } = await auth.registerUser(alice)
    expect(adopted).toBe(true)
    expect(localStorage.getItem('worklog:v1:tasks')).toBeNull()
    const r1 = new LocalStorageRepository({ userId: first.id })
    expect((await r1.listTasks())[0].title).toBe('Legacy')
    const { user: second, adopted: adopted2 } = await auth.registerUser(bob)
    expect(adopted2).toBe(false)
    expect(await new LocalStorageRepository({ userId: second.id }).listTasks()).toHaveLength(0)
  })
})

describe('validation', () => {
  it('register schema checks match and format', () => {
    expect(registerSchema.safeParse({ ...alice, confirm: 'different1' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...alice, confirm: alice.password }).success).toBe(true)
    expect(registerSchema.safeParse({ ...alice, email: 'nope', confirm: alice.password }).success).toBe(false)
  })
  it('strength meter grows with variety', () => {
    expect(passwordStrength('abc')).toBe(0)
    expect(passwordStrength('Abcdefgh1234!')).toBeGreaterThanOrEqual(3)
  })
})
