<template>
  <view class="privacy">
    <view class="card">
      <text class="title">隐私政策</text>
      <scroll-view scroll-y class="body">
        <text class="para strong">生效日期：2026-08-30　版本：{{version}}</text>
        <text class="para">欢迎使用「恋爱成长」（以下简称"本小程序"）。我们依据《中华人民共和国个人信息保护法》《网络安全法》及微信小程序平台规范制定本政策，说明我们如何收集、使用、存储与保护你的个人信息。使用本小程序前，请仔细阅读并理解本政策。</text>

        <text class="para h">一、我们收集的信息及用途</text>
        <text class="para">1. 账号标识：微信 openid（登录与账号唯一标识，无法单独识别真实身份）。</text>
        <text class="para">2. 基础资料：昵称、头像、性别、年龄、兴趣标签（用于资料展示与匹配推荐）。</text>
        <text class="para">3. 联系方式：微信号与二维码。仅在双方关系成长达到 S4 阶段、且你主动确认导出时才向对方展示，默认不公开。</text>
        <text class="para">4. 互动行为：成长值、关系阶段、匹配记录（用于核心功能运转与产品体验优化）。</text>
        <text class="para">5. 消息内容：私聊与社区发帖正文。依据"先审后发"原则，服务端在内容安全审核通过后才投递/展示。</text>
        <text class="para">6. 埋点事件：仅记录事件 ID、枚举与数值（不含任何个人身份信息），用于产品统计与异常排查。</text>

        <text class="para h">二、信息的存储与地理位置</text>
        <text class="para">你的数据存储于腾讯云开发（CloudBase）境内节点，采用云开发安全规则与最小权限原则保护。我们在实现服务目的所必需的最短期限内保留信息；账号注销后，我们将删除或匿名化你的个人资料。</text>

        <text class="para h">三、信息共享</text>
        <text class="para">我们不会向无关第三方出售或提供你的个人信息。仅在以下情形共享：(1) 微信云开发基础设施（运行所必需）；(2) 微信内容安全审核服务（在内容安全开启后，文本送审用于违规识别）。除法律法规要求或获得你的明示同意外，不做其他共享。</text>

        <text class="para h">四、你的权利</text>
        <text class="para">1. 查阅与更正：你可随时在资料页查看、修改个人资料。</text>
        <text class="para">2. 撤回同意：清除本地隐私同意标记（rg_privacy_agreed）后，本小程序将再次弹出本门禁；撤回后未登录期间我们不处理你的数据。</text>
        <text class="para">3. 删除与注销：你可通过下方运营方联系方式申请删除个人资料或注销账号，我们将在合理期限内处理。</text>

        <text class="para h">五、未成年人保护</text>
        <text class="para">本小程序主要面向成年用户。若你是未成年人，请在监护人陪同下使用；我们不会主动收集未成年人的敏感信息，如发现误注册将协助注销。</text>

        <text class="para h">六、联系方式</text>
        <text class="para">如对本政策有疑问或需行使上述权利，可联系运营方：loveapp-privacy@example.com（上线前请替换为真实运营邮箱）。</text>

        <text class="para h">七、政策更新</text>
        <text class="para">我们可能适时更新本政策，重大变更将提升版本号并通过小程序内强制重新弹窗提示（依据本地同意版本判定）。更新后继续使用即视为同意修订版。</text>

        <text class="para strong">继续使用即表示你理解并同意上述条款。</text>
      </scroll-view>
      <button class="agree-btn" @click="onAgree">同意并继续</button>
      <text class="decline" @click="onDecline">暂不同意</text>
    </view>
  </view>
</template>

<script>
import { setPrivacyAgreed, PRIVACY_VERSION } from '../../utils/storage'

export default {
  data() {
    return { version: PRIVACY_VERSION }
  },
  methods: {
    onAgree() {
      setPrivacyAgreed()
      uni.reLaunch({ url: '/pages/login/login' })
    },
    onDecline() {
      uni.showToast({ title: '需同意后才能使用', icon: 'none' })
    }
  }
}
</script>

<style>
.privacy { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #FFF7F8; padding: 32rpx; }
.card { width: 100%; background: #fff; border-radius: 24rpx; padding: 40rpx; box-shadow: 0 8rpx 30rpx rgba(255,107,129,0.12); }
.title { font-size: 38rpx; font-weight: 700; color: #FF6B81; display: block; margin-bottom: 24rpx; }
.body { max-height: 860rpx; }
.para { font-size: 26rpx; color: #666; line-height: 1.7; display: block; margin-bottom: 14rpx; }
.h { font-size: 28rpx; font-weight: 700; color: #333; margin-top: 18rpx; margin-bottom: 10rpx; }
.strong { color: #FF6B81; font-weight: 600; margin-top: 10rpx; }
.agree-btn { margin-top: 32rpx; height: 88rpx; line-height: 88rpx; background: #FF6B81; color: #fff; border-radius: 44rpx; font-size: 32rpx; }
.decline { display: block; text-align: center; margin-top: 20rpx; font-size: 26rpx; color: #999; }
</style>
