<template>
  <view class="admin">
    <view class="tabs">
      <view class="tab" :class="{ active: tab === 'pending' }" @click="switchTab('pending')">
        待处置{{ pendingCount ? '(' + pendingCount + ')' : '' }}
      </view>
      <view class="tab" :class="{ active: tab === 'handled' }" @click="switchTab('handled')">
        已处置
      </view>
    </view>

    <view class="list" v-if="!loading && reports.length">
      <view class="card" v-for="rep in reports" :key="rep.id">
        <view class="card-head">
          <text class="type">{{ rep.targetType === 'user' ? '用户' : '帖子' }}举报</text>
          <text class="status" :class="rep.status">{{ statusText(rep.status) }}</text>
        </view>
        <view class="card-meta">
          <text>举报人：{{ rep.reporterNickname }}</text>
          <text class="time">{{ formatDate(rep.createdAt) }}</text>
        </view>
        <view class="reason" v-if="rep.reasonPreview">原因：{{ rep.reasonPreview }}</view>

        <block v-if="rep.status === 'pending'">
          <textarea class="note" v-model="notes[rep.id]" maxlength="200" placeholder="处置备注（选填，仅管理员可见）"></textarea>
          <view class="actions">
            <button class="btn handled" :loading="busy" @click="onHandle(rep, 'handled')">处置</button>
            <button class="btn dismissed" :loading="busy" @click="onHandle(rep, 'dismissed')">驳回</button>
          </view>
        </block>

        <view class="done-info" v-else>
          <text>处置结果：{{ rep.decision === 'handled' ? '已处理' : '已驳回' }}</text>
          <text class="time" v-if="rep.handledAt">{{ formatDate(rep.handledAt) }}</text>
        </view>
      </view>
    </view>

    <view class="empty" v-if="!loading && !reports.length">
      {{ tab === 'pending' ? '暂无待处置举报' : '暂无已处置记录' }}
    </view>
    <view class="loading" v-if="loading">加载中…</view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { isCurrentUserAdmin } from '../../utils/admin'

export default {
  data() {
    return {
      isAdmin: false,
      tab: 'pending',
      reports: [],
      pendingCount: 0,
      loading: false,
      busy: false,
      notes: {} // 每条举报的处置备注（按 id 存）
    }
  },
  async onShow() {
    if (!this.isAdmin) {
      const ok = await isCurrentUserAdmin()
      if (!ok) {
        uni.showToast({ title: '无权限访问', icon: 'none' })
        setTimeout(() => uni.navigateBack(), 800)
        return
      }
      this.isAdmin = true
    }
    this.load()
  },
  methods: {
    async load() {
      this.loading = true
      const r = await callFunction('safety', { action: 'listReports', status: this.tab })
      this.loading = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '加载失败', icon: 'none' })
        return
      }
      this.reports = (r.data && r.data.reports) || []
      if (this.tab === 'pending') this.pendingCount = this.reports.length
      // 切到已处置 tab 时也刷新一下待处置计数
      if (this.tab === 'handled') this.refreshPendingCount()
    },
    async refreshPendingCount() {
      const r = await callFunction('safety', { action: 'listReports', status: 'pending' })
      if (r.ok && r.data) this.pendingCount = (r.data.reports || []).length
    },
    switchTab(status) {
      if (this.tab === status) return
      this.tab = status
      this.load()
    },
    async onHandle(rep, decision) {
      if (this.busy) return
      if (rep.status !== 'pending') return
      this.busy = true
      const r = await callFunction('safety', {
        action: 'handleReport',
        reportId: rep.id,
        decision,
        note: (this.notes[rep.id] || '').trim()
      })
      this.busy = false
      if (!r.ok) {
        uni.showToast({ title: r.message || '操作失败', icon: 'none' })
        return
      }
      if (r.data && r.data.alreadyHandled) {
        uni.showToast({ title: '该举报已处置', icon: 'none' })
      } else {
        uni.showToast({ title: decision === 'handled' ? '已处置' : '已驳回', icon: 'success' })
      }
      // 处置后该条移出 pending，刷新列表
      this.notes[rep.id] = ''
      this.load()
    },
    statusText(s) {
      return s === 'pending' ? '待处置' : s === 'handled' ? '已处理' : s === 'dismissed' ? '已驳回' : s
    },
    formatDate(ts) {
      const d = new Date(Number(ts))
      if (isNaN(d.getTime())) return ''
      const p = n => String(n).padStart(2, '0')
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
    }
  }
}
</script>

<style scoped>
.admin { min-height: 100vh; background: var(--bg, #FFFAFB); padding-bottom: 40rpx; }
.tabs { display: flex; background: #fff; padding: 12rpx 24rpx 0; }
.tab {
  flex: 1;
  text-align: center;
  font-size: 28rpx;
  color: #999;
  padding: 20rpx 0;
  border-bottom: 4rpx solid transparent;
}
.tab.active { color: var(--brand-500, #F43F6A); font-weight: 600; border-bottom-color: var(--brand-500, #F43F6A); }
.list { padding: 20rpx 24rpx; }
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 18rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 129, 0.08);
}
.card-head { display: flex; justify-content: space-between; align-items: center; }
.type { font-size: 30rpx; color: #333; font-weight: 600; }
.status { font-size: 24rpx; color: #fff; background: #FFB74D; padding: 6rpx 18rpx; border-radius: 20rpx; }
.status.handled { background: #66BB6A; }
.status.dismissed { background: #bdbdbd; }
.card-meta { display: flex; justify-content: space-between; margin-top: 14rpx; font-size: 24rpx; color: #888; }
.time { color: #aaa; }
.reason { margin-top: 12rpx; font-size: 26rpx; color: #555; background: #FFF3F5; border-radius: 12rpx; padding: 16rpx; }
.note { width: 100%; height: 120rpx; margin-top: 16rpx; background: #fafafa; border-radius: 12rpx; padding: 16rpx; font-size: 26rpx; box-sizing: border-box; }
.actions { display: flex; gap: 20rpx; margin-top: 16rpx; }
.btn { flex: 1; height: 76rpx; line-height: 76rpx; border-radius: 38rpx; font-size: 28rpx; color: #fff; margin: 0; }
.btn.handled { background: var(--brand-500, #F43F6A); }
.btn.dismissed { background: #f2f2f2; color: #666; }
.done-info { display: flex; justify-content: space-between; margin-top: 14rpx; font-size: 24rpx; color: #888; }
.empty, .loading { text-align: center; font-size: 26rpx; color: #bbb; padding: 60rpx 0; }
</style>
