import { ImageCropFrame } from './ImageCropFrame'
import { useLanguage } from '../i18n/LanguageProvider'

export function ImageUploadPanel() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">
          {t('upload.title')}
        </h2>
        <p className="text-sm text-neutral-500">{t('upload.hint')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ImageCropFrame slot="A" badge={t('image.a.badge')} name={t('image.a.name')} />
        <ImageCropFrame slot="B" badge={t('image.b.badge')} name={t('image.b.name')} />
      </div>
    </div>
  )
}
