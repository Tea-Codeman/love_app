<template>
  <view class="community">
    <view class="topbar">
      <text class="title">社区</text>
    </view>
    <scroll-view class="tabs" scroll-x enable-flex>
      <view class="tab" :class="{ active: activeTopic === '' }" @click="selectTopic('')">全部</view>
      <view
        class="tab"
        v-for="t in topics"
        :key="t._id"
        :class="{ active: activeTopic === t._id }"
        @click="selectTopic(t._id)"
      >{{ t.name }}</view>
    </scroll-view>

    <view class="feed">
      <post-card
        v-for="p in posts"
        :key="p._id"
        :post="p"
        @select="onPostTap"
      ></post-card>
      <view class="empty" v-if="!loading && posts.length === 0">还没有帖子，去发第一条吧 ›</view>
      <view class="loading" v-if="loading">加载中…</view>
      <view class="nomore" v-if="!loading && posts.length > 0 && !hasMore">没有更多了</view>
    </view>

    <view class="fab" @click="goPost">＋</view>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import postCard from '../../components/post-card.vue'

export default {
  components: { postCard },
  data() {
    return {
      topics: [],
      posts: [],
      activeTopic: '',
      page: 0,
      pageSize: 10,
      hasMore: true,
      loading: false
    }
  },
  onLoad() {
    // 说明（2026-08-28 修复 showShareMenu:fail banned）：
    // 微信基础库在页面定义 onShareAppMessage 时会【内部自动】调用 showShareMenu 以启用「…」转发菜单；
    // 本项目是个人主体 / 社交类目小程序，微信平台禁止分享能力，该内部调用返回 fail banned 并在控制台报错。
    // 由于个人账号下分享本就被封、onShareAppMessage 无实际作用，故暂不定义它以消除报错。
    // ⚠️ 待转企业主体 + 社交类目资质就绪后，需重新加回 onShareAppMessage（及 community 页「邀请好友」入口）才能恢复 M1.5 裂变。
  },
  onShow() {
    this.loadTopics()
    this.reloadPosts()
  },
  onReachBottom() {
    if (this.hasMore && !this.loading) this.loadPosts(false)
  },
  methods: {
    async loadTopics() {
      const r = await callFunction('community', { action: 'listTopics' })
      if (r.ok) this.topics = (r.data && r.data.topics) || []
      else if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })
    },
    async reloadPosts() {
      this.page = 0
      this.posts = []
      this.hasMore = true
      await this.loadPosts(true)
    },
    async loadPosts(reset) {
      if (this.loading) return
      this.loading = true
      const r = await callFunction('community', {
        action: 'listPosts',
        page: this.page,
        pageSize: this.pageSize,
        topicId: this.activeTopic
      })
      this.loading = false
      if (!r.ok) {
        if (r.code === 500) uni.showToast({ title: r.message, icon: 'none' })
        return
      }
      const list = (r.data && r.data.posts) || []
      this.posts = reset ? list : this.posts.concat(list)
      this.hasMore = !!(r.data && r.data.hasMore)
      if (!reset) this.page++
    },
    selectTopic(id) {
      if (id === this.activeTopic) return
      this.activeTopic = id
      this.reloadPosts()
    },
    onPostTap(post) {
      // 防双触发兜底（2026-08-28）：post-card 原以原生事件名 tap 发自定义事件 → 一次点击触发两次（第二次是事件对象，post 为 undefined）；
      // 已改名为 select + 组件声明 emits 根治；此校验确保无效/重复跳转不会发生。
      if (!post || !post._id) return

      const url = '/pages/community/detail?postId=' + post._id
      uni.navigateTo({
        url
  })
    },
    goPost() {
      uni.navigateTo({ url: '/pages/community/post' })
    }
  }
}
</script>

<style>
.community { min-height: 100vh; background: #FFF7F8; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 24rpx 32rpx 8rpx; }
.title { font-size: 38rpx; font-weight: 700; color: #FF6B81; }
.invite { font-size: 26rpx; color: #fff; background: #FF6B81; padding: 10rpx 24rpx; border-radius: 28rpx; }
.tabs {
  white-space: nowrap;
  padding: 16rpx 12rpx;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
}
.tab {
  display: inline-block;
  padding: 12rpx 28rpx;
  margin: 0 8rpx;
  font-size: 28rpx;
  color: #666;
  background: #f5eef0;
  border-radius: 32rpx;
}
.tab.active { color: #fff; background: #FF6B81; }
.feed { padding-bottom: 40rpx; }
.empty, .nomore, .loading {
  text-align: center;
  font-size: 26rpx;
  color: #bbb;
  padding: 60rpx 0;
}
.fab {
  position: fixed;
  right: 40rpx;
  bottom: 60rpx;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: #FF6B81;
  color: #fff;
  font-size: 56rpx;
  line-height: 92rpx;
  text-align: center;
  box-shadow: 0 8rpx 24rpx rgba(255, 107, 129, 0.4);
}
</style>
