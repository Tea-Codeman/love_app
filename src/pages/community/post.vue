<template>
  <view class="post-edit">
    <view class="field">
      <text class="label">话题</text>
      <picker :range="topicNames" @change="onTopic">
        <view class="picker">{{ topicNames[topicIndex] || '请选择话题' }}</view>
      </picker>
    </view>
    <textarea class="content" v-model="content" maxlength="500" placeholder="分享你的故事…（先审后发）"></textarea>
    <view class="counter">{{ content.length }}/500</view>
    <view class="images">
      <view class="img-wrap" v-for="(img, i) in images" :key="i">
        <image class="img" :src="img" mode="aspectFill"></image>
        <text class="del" @click="removeImg(i)">×</text>
      </view>
      <view class="img-add" @click="chooseImg" v-if="images.length < 9">＋</view>
    </view>
    <button class="submit" :loading="submitting" @click="onSubmit">发布</button>
    <text class="tip" v-if="msg">{{ msg }}</text>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'

export default {
  data() {
    return {
      topics: [],
      topicNames: [],
      topicIndex: -1,
      topicId: '',
      content: '',
      images: [],
      submitting: false,
      msg: ''
    }
  },
  onLoad() {
    this.loadTopics()
  },
  methods: {
    async loadTopics() {
      const r = await callFunction('community', { action: 'listTopics' })
      if (r.ok) {
        this.topics = (r.data && r.data.topics) || []
        this.topicNames = this.topics.map(t => t.name)
      }
    },
    onTopic(e) {
      this.topicIndex = Number(e.detail.value)
      this.topicId = this.topics[this.topicIndex] ? this.topics[this.topicIndex]._id : ''
    },
    chooseImg() {
      const that = this
      uni.chooseMedia({
        count: 9 - this.images.length,
        mediaType: ['image'],
        success(res) {
          res.tempFiles.forEach(f => {
            wx.cloud.uploadFile({
              cloudPath: 'posts/' + Date.now() + Math.floor(Math.random() * 1e4) + '.png',
              filePath: f.tempFilePath,
              success(up) { that.images.push(up.fileID) },
              fail() { that.msg = '图片上传失败' }
            })
          })
        }
      })
    },
    removeImg(i) { this.images.splice(i, 1) },
    async onSubmit() {
      this.msg = ''
      if (!this.topicId) { this.msg = '请选择话题'; return }
      if (!this.content.trim()) { this.msg = '内容不能为空'; return }
      this.submitting = true
      const r = await callFunction('community', {
        action: 'createPost',
        topicId: this.topicId,
        content: this.content,
        images: this.images
      })
      this.submitting = false
      if (!r.ok) { this.msg = r.message || '发布失败'; return }
      uni.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 600)
    }
  }
}
</script>

<style scoped>
.post-edit { padding: 32rpx; background: var(--bg, #FFFAFB); min-height: 100vh; }
.field { display: flex; align-items: center; padding: 20rpx 0; }
.label { width: 120rpx; font-size: 28rpx; color: #555; }
.picker { flex: 1; font-size: 28rpx; color: #333; background: #fff; padding: 18rpx 24rpx; border-radius: 12rpx; }
.content {
  width: 100%;
  height: 280rpx;
  margin-top: 16rpx;
  padding: 24rpx;
  box-sizing: border-box;
  font-size: 30rpx;
  background: #fff;
  border-radius: 16rpx;
}
.counter { text-align: right; font-size: 22rpx; color: #bbb; margin-top: 8rpx; }
.images { display: flex; flex-wrap: wrap; margin-top: 20rpx; }
.img-wrap { position: relative; width: 160rpx; height: 160rpx; margin: 0 16rpx 16rpx 0; }
.img { width: 160rpx; height: 160rpx; border-radius: 12rpx; }
.del { position: absolute; top: -12rpx; right: -12rpx; width: 40rpx; height: 40rpx; line-height: 36rpx; text-align: center; background: rgba(0,0,0,0.5); color: #fff; border-radius: 50%; font-size: 32rpx; }
.img-add { width: 160rpx; height: 160rpx; line-height: 156rpx; text-align: center; font-size: 60rpx; color: #ccc; background: #fff; border: 2rpx dashed #ddd; border-radius: 12rpx; }
.submit { margin-top: 48rpx; height: 88rpx; line-height: 88rpx; background: var(--brand-500, #F43F6A); color: #fff; border-radius: 44rpx; font-size: 32rpx; }
.tip { display: block; text-align: center; margin-top: 20rpx; font-size: 24rpx; color: #e74c3c; }
</style>
