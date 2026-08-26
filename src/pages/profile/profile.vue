<template>
  <view class="profile">
    <view class="field">
      <text class="label">昵称</text>
      <input class="input" v-model="form.nickname" maxlength="20" placeholder="给自己起个名字" />
    </view>
    <view class="field">
      <text class="label">头像</text>
      <image class="avatar" :src="avatarPreview || form.avatarUrl || '/static/logo.png'" mode="aspectFill" @click="onChooseAvatar"></image>
    </view>
    <view class="field">
      <text class="label">性别</text>
      <picker :range="genders" @change="onGender">
        <view class="picker">{{ genders[form.gender] }}</view>
      </picker>
    </view>
    <view class="field">
      <text class="label">年龄</text>
      <input class="input" type="number" v-model="form.age" placeholder="18-60" />
    </view>
    <view class="field">
      <text class="label">城市</text>
      <input class="input" v-model="form.city" maxlength="30" placeholder="所在城市" />
    </view>
    <view class="field">
      <text class="label">兴趣标签</text>
      <input class="input" v-model="tagsText" placeholder="逗号分隔，如 电影,旅行,音乐" />
    </view>
    <view class="field">
      <text class="label">签名</text>
      <textarea class="textarea" v-model="form.bio" maxlength="100" placeholder="一句话介绍自己"></textarea>
    </view>
    <button class="save-btn" :loading="saving" @click="onSave">保存</button>
    <text class="tip" v-if="msg">{{ msg }}</text>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import { getUser, setUser } from '../../utils/storage'
import { validateProfile } from '../../utils/validate'

export default {
  data() {
    return {
      form: { nickname: '', avatarUrl: '', gender: 0, age: 0, city: '', interestTags: [], bio: '' },
      genders: ['保密', '男', '女'],
      tagsText: '',
      avatarPreview: '',
      saving: false,
      msg: ''
    }
  },
  onLoad() {
    const u = getUser() || {}
    this.form = {
      nickname: u.nickname || '',
      avatarUrl: u.avatarUrl || '',
      gender: u.gender || 0,
      age: u.age || 0,
      city: u.city || '',
      interestTags: u.interestTags || [],
      bio: u.bio || ''
    }
    this.tagsText = (u.interestTags || []).join(',')
  },
  methods: {
    onGender(e) { this.form.gender = Number(e.detail.value) },
    onChooseAvatar() {
      const that = this
      uni.chooseMedia({
        count: 1,
        mediaType: ['image'],
        success(res) {
          const file = res.tempFiles[0].tempFilePath
          that.avatarPreview = file
          wx.cloud.uploadFile({
            cloudPath: 'avatars/' + Date.now() + '.png',
            filePath: file,
            success(up) { that.form.avatarUrl = up.fileID },
            fail() { that.msg = '头像上传失败' }
          })
        }
      })
    },
    async onSave() {
      this.msg = ''
      const tags = this.tagsText.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10)
      const payload = { ...this.form, interestTags: tags, age: Number(this.form.age) || 0 }
      const v = validateProfile(payload)
      if (!v.ok) { this.msg = v.errors[0]; return }
      this.saving = true
      const res = await callFunction('auth', { action: 'updateProfile', profile: payload })
      this.saving = false
      if (!res.ok) { this.msg = res.message || '保存失败'; return }
      if (res.data && res.data.user) setUser(res.data.user)
      this.msg = '已保存'
      setTimeout(() => uni.navigateBack(), 600)
    }
  }
}
</script>

<style>
.profile { padding: 32rpx; background: #FFF7F8; min-height: 100vh; }
.field { display: flex; align-items: center; padding: 24rpx 0; border-bottom: 1rpx solid #f0e3e6; }
.label { width: 160rpx; font-size: 28rpx; color: #555; }
.input { flex: 1; font-size: 28rpx; }
.picker { flex: 1; font-size: 28rpx; color: #333; }
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: #eee; }
.textarea { flex: 1; height: 120rpx; font-size: 28rpx; }
.save-btn { margin-top: 48rpx; height: 88rpx; line-height: 88rpx; background: #FF6B81; color: #fff; border-radius: 44rpx; font-size: 32rpx; }
.tip { display: block; text-align: center; margin-top: 20rpx; font-size: 24rpx; color: #e74c3c; }
</style>
