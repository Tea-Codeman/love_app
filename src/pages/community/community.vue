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

    <view class="compose-fab" @click="goPost">＋</view>
    <tab-bar current="community"></tab-bar>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import postCard from '../../components/post-card.vue'
import tabBar from '../../components/tab-bar.vue'

export default {
  components: { postCard, tabBar },
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

<style scoped>
.community { min-height: 100vh; background: var(--grad-soft, linear-gradient(180deg, #FFF1F4, #FFFAFB)); padding-bottom: 180rpx; }
.topbar { display: flex; align-items: center; justify-content: space-between; padding: 28rpx 32rpx 8rpx; }
.title { font-size: 42rpx; font-weight: 700; color: var(--ink-900, #2B2330); font-family: var(--font-display); }
.tabs {
  white-space: nowrap;
  padding: 16rpx 12rpx;
  background: transparent;
  position: sticky;
  top: 0;
  z-index: 10;
}
.tab {
  display: inline-block;
  padding: 12rpx 30rpx;
  margin: 0 8rpx;
  font-size: 26rpx;
  color: var(--ink-500, #7A7280);
  background: #fff;
  border: 1rpx solid var(--border, #FBE1E7);
  border-radius: 999rpx;
  box-shadow: var(--shadow-sm);
  transition: all .2s ease;
}
.tab.active { color: #fff; background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A)); border-color: transparent; font-weight: 600; }
.feed { padding-bottom: 40rpx; }
.empty, .nomore, .loading { text-align: center; font-size: 26rpx; color: var(--ink-400, #A89FA8); padding: 60rpx 0; }
.compose-fab {
  position: fixed;
  right: 40rpx;
  bottom: calc(env(safe-area-inset-bottom) + 170rpx);
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  color: #fff;
  font-size: 56rpx;
  line-height: 100rpx;
  text-align: center;
  box-shadow: var(--shadow-glow, 0 8rpx 24rpx rgba(244,63,106,.45));
  z-index: 40;
  transition: transform .12s ease;
}
.compose-fab:active { transform: scale(.92); }
</style>
