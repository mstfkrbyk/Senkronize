/** Bağlantı testi / kayıt hataları için kullanıcıya yönelik çözüm önerileri */
export function getConnectionErrorHint(message: string): string | null {
  const lower = message.toLowerCase();

  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('kimlik') ||
    lower.includes('credential')
  ) {
    return 'API anahtarı, mağaza ID veya şifrenizi kontrol edin. Kopyalarken başında/sonunda boşluk kalmadığından emin olun.';
  }

  if (lower.includes('timeout') || lower.includes('zaman aşımı') || lower.includes('etimedout')) {
    return 'Sunucuya ulaşılamadı. VPN, güvenlik duvarı veya IP kısıtlaması olup olmadığını kontrol edin.';
  }

  if (lower.includes('seller') || lower.includes('merchant') || lower.includes('supplier')) {
    return 'Satıcı / tedarikçi kimliğinizin doğru olduğundan ve hesabınızın API erişimine açık olduğundan emin olun.';
  }

  if (lower.includes('limit') || lower.includes('429')) {
    return 'Platform geçici olarak istekleri sınırlıyor. Birkaç dakika sonra tekrar deneyin.';
  }

  if (lower.includes('ssl') || lower.includes('certificate')) {
    return 'ERP sunucu sertifikası veya HTTPS adresi hatalı olabilir. IT ekibinizle servis URL’sini doğrulayın.';
  }

  return 'Alanları tekrar kontrol edin; sorun sürerse platform dokümantasyonundaki API izinlerine bakın.';
}
