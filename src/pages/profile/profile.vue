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
    <view class="field" @click="goMbti">
      <text class="label">MBTI</text>
      <text class="mbti-val" v-if="form.mbti">{{ form.mbti }} · {{ mbtiRole.name }}</text>
      <text class="mbti-empty" v-else>未测评</text>
      <text class="arrow">›</text>
    </view>
    <view class="field">
      <text class="label">签名</text>
      <textarea class="textarea" v-model="form.bio" maxlength="100" placeholder="一句话介绍自己"></textarea>
    </view>
    <!-- M3.4：微信号仅在关系成长到 S4 后对对方可见，服务端按微信规则校验（6-20 位、字母开头） -->
    <view class="field">
      <text class="label">微信号</text>
      <input class="input" v-model="form.wechatId" maxlength="20" placeholder="选填，方便以后互加" />
    </view>
    <text class="privacy-tip">微信号不会公开展示；只有和你的关系成长到 S4（心动确认）的人才能看到。</text>
    <button class="save-btn" :loading="saving" @click="onSave">保存</button>
    <text class="tip" v-if="msg">{{ msg }}</text>
    <tab-bar current="profile"></tab-bar>
  </view>
</template>

<script>
import { callFunction } from '../../utils/request'
import tabBar from '../../components/tab-bar.vue'
import { getUser, setUser } from '../../utils/storage'
import { validateProfile } from '../../utils/validate'
import { getRole } from '../../utils/mbti'

export default {
  components: { tabBar },
  data() {
    return {
      form: { nickname: '', avatarUrl: '', gender: 0, age: 0, city: '', interestTags: [], bio: '', mbti: '', wechatId: '' },
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
      bio: u.bio || '',
      mbti: u.mbti || '',
      wechatId: u.wechatId || ''
    }
    this.tagsText = (u.interestTags || []).join(',')
  },
  // 从 MBTI 测评页保存返回后 onLoad 不会重跑，此处单独回填新类型（避免覆盖未保存的编辑）
  onShow() {
    const u = getUser() || {}
    if (u.mbti) this.form.mbti = u.mbti
  },
  computed: {
    mbtiRole() { return getRole(this.form.mbti) }
  },
  methods: {
    goMbti() {
      uni.navigateTo({ url: '/pages/profile/mbti' })
    },
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
.profile { padding: 32rpx 32rpx 180rpx; background: var(--grad-soft, linear-gradient(180deg, #FFF1F4, #FFFAFB)); min-height: 100vh; }
.field { display: flex; align-items: center; padding: 26rpx 4rpx; border-bottom: 1rpx solid var(--border, #FBE1E7); }
.label { width: 160rpx; font-size: 28rpx; color: var(--ink-500, #7A7280); flex-shrink: 0; }
.input { flex: 1; font-size: 28rpx; color: var(--ink-900, #2B2330); }
.picker { flex: 1; font-size: 28rpx; color: var(--ink-900, #2B2330); }
.avatar { width: 96rpx; height: 96rpx; border-radius: 50%; background: var(--brand-100, #FFE3E9); border: 3rpx solid #fff; box-shadow: 0 0 0 3rpx var(--brand-100, #FFE3E9); }
.textarea { flex: 1; height: 120rpx; font-size: 28rpx; color: var(--ink-900, #2B2330); }
.mbti-val { flex: 1; font-size: 28rpx; color: var(--brand-600, #E11D54); font-weight: 600; }
.mbti-empty { flex: 1; font-size: 28rpx; color: var(--ink-400, #A89FA8); }
.arrow { font-size: 32rpx; color: var(--ink-400, #A89FA8); }
.privacy-tip { display: block; font-size: 22rpx; color: var(--ink-400, #A89FA8); padding: 16rpx 8rpx 0; line-height: 1.6; }
.save-btn {
  margin-top: 48rpx; width: 100%; height: 92rpx; line-height: 92rpx;
  background: var(--grad-primary, linear-gradient(135deg, #FF8A65, #F43F6A));
  color: #fff; border-radius: 999rpx; font-size: 32rpx; font-weight: 600;
  box-shadow: var(--shadow-glow, 0 8rpx 24rpx rgba(244,63,106,.35));
  transition: transform .12s ease;
}
.save-btn:active { transform: scale(.98); }
.tip { display: block; text-align: center; margin-top: 20rpx; font-size: 24rpx; color: var(--danger, #EF4444); }
</style>
