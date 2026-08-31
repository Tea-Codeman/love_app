<template>
  <view class="post-card card anim-in" @tap="handleCardClick">
    <view class="head">
      <image class="avatar" :src="post.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
      <view class="meta">
        <text class="nickname">{{ post.nickname || '匿名' }}</text>
        <text class="topic" v-if="post.topicName">#{{ post.topicName }}</text>
      </view>
    </view>
    <text class="content">{{ post.content }}</text>
    <view class="foot">
      <text class="act act-like" @click.stop="onLike">赞 {{ (post.likes || []).length }}</text>
      <text class="act">评 {{ post.commentCount || 0 }}</text>
      <text class="time">{{ formatTime(post.createdAt) }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'post-card',
  emits: ['select', 'like'],
  props: {
    post: { type: Object, required: true }
  },
  methods: {
    onLike() {
      this.$emit('like', this.post)
    },
    handleCardClick() {
      this.$emit('select', this.post)
    },
    formatTime(ts) {
      if (!ts) return ''
      const d = Number(ts)
      if (!d) return ''
      const diff = Date.now() - d
      if (diff < 60000) return '刚刚'
      if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
      const date = new Date(d)
      return (date.getMonth() + 1) + '-' + date.getDate()
    }
  }
}
</script>

<style scoped>
.post-card {
  margin: 20rpx 24rpx;
  padding: 28rpx;
  transition: transform .15s ease, box-shadow .2s ease;
}
.post-card:active { transform: scale(.99); }
.head { display: flex; align-items: center; }
.avatar {
  width: 76rpx; height: 76rpx; border-radius: 50%;
  background: var(--brand-100,#FFE3E9);
  border: 3rpx solid #fff;
  box-shadow: 0 0 0 3rpx var(--brand-100,#FFE3E9);
}
.meta { margin-left: 18rpx; display: flex; flex-direction: column; }
.nickname { font-size: 28rpx; color: var(--ink-900,#2B2330); font-weight: 600; }
.topic {
  align-self: flex-start;
  font-size: 20rpx; color: var(--brand-600,#E11D54);
  background: var(--brand-50,#FFF1F4);
  padding: 4rpx 14rpx; border-radius: 999rpx;
  margin-top: 6rpx;
}
.content {
  display: block;
  font-size: 30rpx;
  color: var(--ink-700,#4A4250);
  line-height: 1.6;
  margin: 18rpx 0;
  word-break: break-all;
}
.foot { display: flex; align-items: center; }
.act {
  font-size: 24rpx; color: var(--ink-500,#7A7280);
  margin-right: 32rpx;
  padding: 6rpx 0;
}
.act-like { color: var(--brand-600,#E11D54); font-weight: 600; }
.time { font-size: 22rpx; color: var(--ink-400,#A89FA8); margin-left: auto; }
</style>
