import { Task } from '../models/Task.js'
import { Project } from '../models/Project.js'

/**
 * Aggregates for the analytics screen, computed in MongoDB. Progress statistics:
 *  - avgProgress: mean progress of all tasks in range (completed count as 100)
 *  - avgOpenProgress: mean progress of unfinished tasks only (how far along the work in flight is)
 *  - progressBuckets: how many open tasks are in 0-24 / 25-49 / 50-74 / 75-99 %
 */
export async function summary(userId, { from, to, projectId }) {
  const match = { userId, deletedAt: null, date: { $gte: from, $lte: to } }
  if (projectId) match.projectId = projectId === 'none' ? null : projectId
  const effective = { $cond: [{ $eq: ['$status', 'completed'] }, 100, { $ifNull: ['$progress', 0] }] }

  const [facet] = await Task.aggregate([
    { $match: match },
    { $addFields: { effProgress: effective } },
    {
      $facet: {
        totals: [
          { $group: { _id: null, total: { $sum: 1 }, avgProgress: { $avg: '$effProgress' }, hours: { $sum: { $ifNull: ['$hours', 0] } } } },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 }, avgProgress: { $avg: '$effProgress' } } }],
        open: [
          { $match: { status: { $ne: 'completed' } } },
          { $group: { _id: null, count: { $sum: 1 }, avgProgress: { $avg: '$effProgress' } } },
        ],
        buckets: [
          { $match: { status: { $ne: 'completed' } } },
          { $bucket: { groupBy: '$effProgress', boundaries: [0, 25, 50, 75, 100], default: 'other', output: { count: { $sum: 1 } } } },
        ],
        byDay: [
          { $group: { _id: '$date', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, avgProgress: { $avg: '$effProgress' } } },
          { $sort: { _id: 1 } },
        ],
        byProject: [
          { $group: { _id: '$projectId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, avgProgress: { $avg: '$effProgress' } } },
          { $sort: { total: -1 } },
        ],
      },
    },
  ])

  const names = new Map((await Project.find({ userId, deletedAt: null }).lean()).map((p) => [String(p._id), p]))
  const r1 = (n) => Math.round((n || 0) * 10) / 10
  const status = Object.fromEntries(['pending', 'in_progress', 'blocked', 'completed'].map((s) => [s, 0]))
  facet.byStatus.forEach((s) => (status[s._id] = s.count))
  const labels = ['0-24%', '25-49%', '50-74%', '75-99%']
  const bucketMap = new Map(facet.buckets.map((b) => [b._id, b.count]))

  return {
    range: { from, to },
    total: facet.totals[0]?.total || 0,
    completed: status.completed,
    completionRate: facet.totals[0]?.total ? status.completed / facet.totals[0].total : 0,
    hours: r1(facet.totals[0]?.hours),
    status,
    avgProgress: r1(facet.totals[0]?.avgProgress),
    avgOpenProgress: r1(facet.open[0]?.avgProgress),
    openCount: facet.open[0]?.count || 0,
    progressBuckets: [0, 25, 50, 75].map((b, i) => ({ bucket: labels[i], count: bucketMap.get(b) || 0 })),
    byDay: facet.byDay.map((d) => ({ date: d._id, total: d.total, completed: d.completed, avgProgress: r1(d.avgProgress) })),
    byProject: facet.byProject.map((p) => ({
      projectId: p._id || null,
      name: p._id ? names.get(p._id)?.name || 'Deleted project' : 'No project',
      key: p._id ? names.get(p._id)?.key : null,
      total: p.total, completed: p.completed, avgProgress: r1(p.avgProgress),
    })),
  }
}
