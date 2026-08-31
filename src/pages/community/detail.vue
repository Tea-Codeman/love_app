<template>
  <view class="detail" v-if="post">
    <view class="head">
      <image class="avatar" :src="post.avatarUrl || '/static/logo.png'" mode="aspectFill"></image>
      <view class="meta">
        <text class="nickname">{{ post.nickname || '匿名' }}</text>
        <text class="topic" v-if="post.topicName">#{{ post.topicName }}</text>
      </view>
      <text class="report" @click="goReport">举报</text>
      <text class="block" @click="onBlock">拉黑</text>
    </view>
    <text class="content">{{ post.content }}</text>
    <view class="images" v-if="post.images && post.images.length">
      <image class="img" v-for="(img, i) in post.images" :key="i" :src="img" mode="aspectFill" @click="preview(i)"></image>
    </view>

    <view class="action">
      <text class="like" :class="{ liked }" @click="onLike">♥ {{ likeCount }}</text>
      <text class="ccount">💬 {{ post.commentCount || 0 }}</text>
    </view>

    <view class="comments">
      <text class="c-title">评论（{{ post.commentCount || comments.length }}）</text>
      <view class="c-item" v-for="c in comments" :key="c._id">
        <text class="c-name">{{ c.nickname || '匿名' }}</text>
        <text class="c-text">{{ c.content }}</text>
      </view>
      <view class="c-empty" v-if="comments.length === 0">还没有评论，来抢沙发</view>
      <view class="c-more" v-if="commentHasMore && !commentLoading" @click="loadMoreComments">加载更多评论</view>
      <view class="c-more loading" v-if="commentLoading">加载中…</view>
    </view>

    <view class="comment-bar">
      <input class="c-input" v-model="commentText" placeholder="说点什么…" confirm-type="send" @confirm="onComment" />
      <button class="c-send" @click="onComment">发送</button>
    </view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { getOpenid } from '../../utils/storage'

export default {
  data() {
    return {
      postId: '',
      post: null,
      comments: [],
      commentText: '',
      liked: false,
      likeCount: 0,
      commentPage: 1,
      commentPageSize: 30,
      commentHasMore: false,
      commentLoading: false
    }
  },
  onLoad(options) {
    this.postId = options.postId || ''
    this.loadDetail()
  },
  methods: {
    // 单次云函数调用取「帖子 + 评论」，消除原 getPost/listComments 两次调用的冷启动叠加开销
    async loadDetail() {
      const r = await callFunction('community', { action: 'getPostDetail', postId: this.postId })
      if (!r.ok) {
        // 透传云函数真实报错，便于定位（环境不符 / 索引异常 / 权限问题等）
        uni.showToast({ title: (r.message || ('错误码 ' + r.code)), icon: 'none' })
        return
      }
      const { post, comments, commentHasMore } = r.data || {}
      this.post = post
      const likes = (post && post.likes) || []
      this.likeCount = likes.length
      this.liked = likes.includes(getOpenid())
      this.comments = comments || []
      this.commentPage = 1
      this.commentHasMore = !!commentHasMore
    },
    async onLike() {
      const r = await callFunction('community', { action: 'likePost', postId: this.postId })
      if (r.ok) {
        this.liked = r.data.liked
        this.likeCount = r.data.likeCount
      }
    },
    async onComment() {
      const text = this.commentText.trim()
      if (!text) return
      const r = await callFunction('community', { action: 'addComment', postId: this.postId, content: text })
      if (!r.ok) { uni.showToast({ title: r.message || '评论失败', icon: 'none' }); return }
      this.commentText = ''
      this.comments.push(r.data.comment)
      if (this.post) this.post.commentCount = (this.post.commentCount || 0) + 1
      uni.showToast({ title: '评论成功', icon: 'success' })
    },
    // 评论懒加载：首屏只取 30 条，点「加载更多」按页 append 后续评论。
    async loadMoreComments() {
      if (this.commentLoading || !this.commentHasMore) return
      this.commentLoading = true
      try {
        const r = await callFunction('community', {
          action: 'listComments',
          postId: this.postId,
          page: this.commentPage,
          pageSize: this.commentPageSize
        })
        if (!r.ok) { uni.showToast({ title: r.message || '加载失败', icon: 'none' }); return }
        const list = (r.data && r.data.comments) || []
        if (list.length) {
          this.comments = this.comments.concat(list)
          this.commentPage += 1
        }
        this.commentHasMore = !!(r.data && r.data.hasMore)
      } finally {
        this.commentLoading = false
      }
    },
    preview(i) {
      uni.previewImage({ current: i, urls: this.post.images })
    },
    goReport() {
      uni.navigateTo({ url: '/pages/community/report?targetType=post&targetId=' + this.postId })
    },
    async onBlock() {
      if (!this.post || !this.post.userId) return
      const r = await callFunction('safety', { action: 'block', targetId: this.post.userId })
      if (!r.ok) { uni.showToast({ title: r.message || '拉黑失败', icon: 'none' }); return }
      uni.showToast({ title: '已拉黑', icon: 'success' })
      // 拉黑后该作者帖子已从信息流过滤（M1.4），停留在被拉黑者的详情页成为死胡同，
      // 故拉黑成功后自动跳回社区：通常由社区 navigateTo 进入（栈内多页）→ navigateBack；
      // 若为分享深链直达（栈仅 1 页）→ redirectTo 社区兜底。
      setTimeout(() => {
        const pages = getCurrentPages()
        if (pages.length > 1) {
          uni.navigateBack()
        } else {
          uni.redirectTo({ url: '/pages/community/community' })
        }
      }, 800)
    }
  }
}
</script>

<style>
.detail { padding: 32rpx; background: var(--bg, #FFFAFB); min-height: 100vh; padding-bottom: 140rpx; }
.head { display: flex; align-items: center; }
.avatar { width: 72rpx; height: 72rpx; border-radius: 50%; background: #eee; }
.meta { margin-left: 18rpx; display: flex; flex-direction: column; flex: 1; }
.nickname { font-size: 28rpx; color: #333; font-weight: 600; }
.topic { font-size: 22rpx; color: var(--brand-500, #F43F6A); margin-top: 4rpx; }
.report { font-size: 24rpx; color: #999; margin-left: 20rpx; }
.block { font-size: 24rpx; color: #999; margin-left: 20rpx; }
.content { display: block; font-size: 32rpx; color: #333; line-height: 1.6; margin: 24rpx 0; word-break: break-all; }
.images { display: flex; flex-wrap: wrap; }
.img { width: 200rpx; height: 200rpx; border-radius: 12rpx; margin: 0 12rpx 12rpx 0; }
.action { display: flex; align-items: center; padding: 24rpx 0; border-top: 1rpx solid #f0e3e6; border-bottom: 1rpx solid #f0e3e6; }
.like { font-size: 30rpx; color: #999; }
.like.liked { color: var(--brand-500, #F43F6A); }
.ccount { font-size: 28rpx; color: #999; margin-left: 40rpx; }
.comments { margin-top: 24rpx; }
.c-title { font-size: 26rpx; color: #888; }
.c-item { padding: 16rpx 0; border-bottom: 1rpx solid #f5eef0; }
.c-name { font-size: 26rpx; color: var(--brand-500, #F43F6A); margin-right: 12rpx; }
.c-text { font-size: 28rpx; color: #333; }
.c-empty { text-align: center; font-size: 24rpx; color: #bbb; padding: 40rpx 0; }
.c-more { text-align: center; font-size: 26rpx; color: var(--brand-500, #F43F6A); padding: 28rpx 0; }
.c-more.loading { color: #bbb; }
.comment-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; padding: 16rpx 24rpx; background: #fff; box-shadow: 0 -2rpx 12rpx rgba(0,0,0,0.05); }
.c-input { flex: 1; background: #f5eef0; border-radius: 32rpx; padding: 16rpx 28rpx; font-size: 28rpx; }
.c-send { margin-left: 16rpx; background: var(--brand-500, #F43F6A); color: #fff; font-size: 28rpx; border-radius: 32rpx; padding: 0 32rpx; }
</style>
