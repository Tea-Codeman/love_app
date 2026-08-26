<template>
  <view class="post-card" @click="$emit('tap', post)">
    <view class="head">
      <image class="avatar" :src="post.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
      <view class="meta">
        <text class="nickname">{{ post.nickname || '匿名' }}</text>
        <text class="topic" v-if="post.topicName">#{{ post.topicName }}</text>
      </view>
    </view>
    <text class="content">{{ post.content }}</text>
    <view class="foot">
      <text class="stat" @click.stop="onLike">♥ {{ (post.likes || []).length }}</text>
      <text class="stat">💬 {{ post.commentCount || 0 }}</text>
      <text class="time">{{ formatTime(post.createdAt) }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'post-card',
  props: {
    post: { type: Object, required: true }
  },
  methods: {
    onLike() {
      this.$emit('like', this.post)
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

<style>
.post-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx;
  margin: 20rpx 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(255, 107, 129, 0.08);
}
.head { display: flex; align-items: center; }
.avatar { width: 72rpx; height: 72rpx; border-radius: 50%; background: #eee; }
.meta { margin-left: 18rpx; display: flex; flex-direction: column; }
.nickname { font-size: 28rpx; color: #333; font-weight: 600; }
.topic { font-size: 22rpx; color: #FF6B81; margin-top: 4rpx; }
.content {
  display: block;
  font-size: 30rpx;
  color: #333;
  line-height: 1.5;
  margin: 18rpx 0;
  word-break: break-all;
}
.foot { display: flex; align-items: center; }
.stat { font-size: 24rpx; color: #999; margin-right: 32rpx; }
.time { font-size: 22rpx; color: #bbb; margin-left: auto; }
</style>
