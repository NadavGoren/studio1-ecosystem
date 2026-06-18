/**
 * Single source of truth for ALL user-facing text.
 *
 * i18n: every language provides the full `Strings` key set. Switch the whole UI
 * (including layout direction) by changing `activeLanguage`. RTL is driven by the
 * language's `dir` flag, applied to <html> by the LanguageProvider.
 */

export type LayoutDir = 'ltr' | 'rtl'

export type Language = {
  code: string
  dir: LayoutDir
  strings: Strings
}

export type Strings = {
  'app.title': string
  'app.tagline': string
  'app.startOver': string
  'app.startOverConfirm': string

  'step.upload': string
  'step.adjust': string
  'step.preview': string
  'step.export': string

  'shell.controlsTitle': string
  'shell.previewTitle': string

  'upload.title': string
  'upload.hint': string
  'upload.dropzone': string
  'upload.dropzoneSub': string
  'upload.change': string
  'upload.reset': string
  'upload.zoom': string
  'upload.dragHint': string
  'upload.errorType': string
  'upload.errorGeneric': string

  'image.a.badge': string
  'image.a.name': string
  'image.b.badge': string
  'image.b.name': string

  'controls.title': string
  'controls.slices': string
  'controls.slicesHelp': string
  'controls.angle': string
  'controls.angleHelp': string
  'controls.size': string
  'controls.width': string
  'controls.height': string
  'controls.custom': string
  'controls.portrait': string
  'controls.landscape': string
  'controls.margins': string
  'controls.marginsHelp': string
  'controls.marginsWidth': string
  'controls.dividers': string
  'controls.dividersHelp': string
  'controls.dividersWidth': string
  'controls.dividersColor': string
  'controls.dividersAuto': string
  'controls.dividersAutoHelp': string

  'section.slicesAngle': string
  'section.slicesAngleDesc': string
  'section.size': string
  'section.sizeDesc': string
  'section.dimensionsDesc': string
  'section.livePreview': string
  'section.livePreviewDesc': string
  'section.detailsDesc': string
  'section.profileDesc': string

  'common.enable': string

  'unit.cm': string
  'unit.mm': string

  'profile.title': string
  'profile.wall': string
  'profile.aFaces': string
  'profile.bFaces': string
  'profile.repeats': string
  'profile.unitsNote': string

  'dims.title': string
  'dims.finished': string
  'dims.flatSheet': string
  'dims.flatSheetHelp': string
  'dims.foldDepth': string
  'dims.strips': string
  'dims.stripsValue': string
  'dims.stripWidth': string
  'dims.printFile': string

  'preview.flat': string
  'preview.flatHelp': string
  'preview.reconstructionTitle': string
  'preview.left': string
  'preview.right': string
  'preview.needImageA': string
  'preview.needImageB': string
  'preview.3d': string
  'preview.3dHelp': string
  'preview.3dLoading': string
  'preview.needBoth': string
  'preview.save3d': string

  'export.title': string
  'export.format': string
  'export.dpi': string
  'export.filename': string
  'export.button': string
  'export.busy': string
  'export.needBoth': string
  'export.hint': string
  'export.error': string
}

const en: Strings = {
  'app.title': 'Agamograph Studio',
  'app.tagline': 'Turn two images into a print-ready agamograph.',
  'app.startOver': 'Start over',
  'app.startOverConfirm':
    'Start over? Your current images and settings will be cleared.',

  'step.upload': 'Upload',
  'step.adjust': 'Adjust',
  'step.preview': 'Preview',
  'step.export': 'Export',

  'shell.controlsTitle': 'Controls',
  'shell.previewTitle': 'Preview',

  'upload.title': 'Upload your two images',
  'upload.hint':
    'Add the picture seen from the left (A) and the one seen from the right (B).',
  'upload.dropzone': 'Click to choose an image',
  'upload.dropzoneSub': 'or drag & drop — JPG, PNG or WEBP',
  'upload.change': 'Change',
  'upload.reset': 'Reset position',
  'upload.zoom': 'Zoom',
  'upload.dragHint': 'After uploading, drag to reposition and use Zoom.',
  'upload.errorType': 'Please choose a JPG, PNG or WEBP image.',
  'upload.errorGeneric': 'Sorry — that image could not be loaded.',

  'image.a.badge': 'A',
  'image.a.name': 'Left view',
  'image.b.badge': 'B',
  'image.b.name': 'Right view',

  'controls.title': 'Settings',
  'controls.slices': 'Number of slices',
  'controls.slicesHelp': 'How many strips each image is cut into.',
  'controls.angle': 'Fold angle',
  'controls.angleHelp': 'The angle of each accordion fold.',
  'controls.size': 'Finished size',
  'controls.width': 'Width',
  'controls.height': 'Height',
  'controls.custom': 'Custom…',
  'controls.portrait': 'Portrait',
  'controls.landscape': 'Landscape',
  'controls.margins': 'Margins',
  'controls.marginsHelp': 'White border on the left & right edges, with a gray cut line for trimming.',
  'controls.marginsWidth': 'Margin width',
  'controls.dividers': 'Fold dividers',
  'controls.dividersHelp': 'Print a thin line between every strip.',
  'controls.dividersWidth': 'Line width',
  'controls.dividersColor': 'Color',
  'controls.dividersAuto': 'Auto (invisible)',
  'controls.dividersAutoHelp':
    'Each line borrows the colors of the two strips around it, so the fold lines disappear into the image.',

  'section.slicesAngle': 'Slices & fold angle',
  'section.slicesAngleDesc': 'How many strips, and the fold angle',
  'section.size': 'Print size',
  'section.sizeDesc': 'The finished size on the wall',
  'section.dimensionsDesc': 'Calculated sizes and the print file',
  'section.livePreview': 'Live preview',
  'section.livePreviewDesc': 'Updates with every change',
  'section.detailsDesc': 'Reconstructed views and the fold profile',
  'section.profileDesc': 'Side cross-section of the fold — angle, width and depth',

  'common.enable': 'Enable',

  'unit.cm': 'cm',
  'unit.mm': 'mm',

  'profile.title': 'Fold profile (cross-section)',
  'profile.wall': 'wall',
  'profile.aFaces': 'A faces',
  'profile.bFaces': 'B faces',
  'profile.repeats': 'repeats ×{n} folds',
  'profile.unitsNote': 'Dimensions in cm',

  'dims.title': 'Dimensions',
  'dims.finished': 'Final folded size on the wall',
  'dims.flatSheet': 'Flat sheet (to print)',
  'dims.flatSheetHelp':
    'The flat sheet is wider than the finished piece — folding takes up the extra width.',
  'dims.foldDepth': 'Fold depth',
  'dims.strips': 'Strips',
  'dims.stripsValue': '{total} total ({n} per image)',
  'dims.stripWidth': 'Strip width',
  'dims.printFile': 'Print file',

  'preview.flat': 'Print sheet',
  'preview.flatHelp':
    'This is what gets printed. Fold into an accordion along the lines.',
  'preview.reconstructionTitle': 'How each side reads',
  'preview.left': 'Seen from the left (A)',
  'preview.right': 'Seen from the right (B)',
  'preview.needImageA': 'Upload image A',
  'preview.needImageB': 'Upload image B',
  'preview.3d': '3D preview',
  'preview.3dHelp': 'Drag left and right to walk past the artwork.',
  'preview.3dLoading': 'Loading 3D preview…',
  'preview.needBoth': 'Upload both images to see the folded preview.',
  'preview.save3d': 'Save view as JPG',

  'export.title': 'Export',
  'export.format': 'File type',
  'export.dpi': 'Quality (DPI)',
  'export.filename': 'File name',
  'export.button': 'Export print file',
  'export.busy': 'Exporting…',
  'export.needBoth': 'Upload both images to export.',
  'export.hint': 'Saves the flat sheet, ready to print and fold.',
  'export.error': 'Sorry — the export failed. Please try again.',
}

const he: Strings = {
  'app.title': 'אגמוגרף סטודיו',
  'app.tagline': 'הופכים שתי תמונות לאגמוגרף מוכן להדפסה.',
  'app.startOver': 'התחלה מחדש',
  'app.startOverConfirm': 'להתחיל מחדש? התמונות וההגדרות הנוכחיות יימחקו.',

  'step.upload': 'העלאה',
  'step.adjust': 'התאמה',
  'step.preview': 'תצוגה',
  'step.export': 'ייצוא',

  'shell.controlsTitle': 'בקרות',
  'shell.previewTitle': 'תצוגה מקדימה',

  'upload.title': 'העלו שתי תמונות',
  'upload.hint': 'הוסיפו את התמונה הנראית משמאל (A) ואת הנראית מימין (B).',
  'upload.dropzone': 'לחצו לבחירת תמונה',
  'upload.dropzoneSub': 'או גררו לכאן — JPG, PNG או WEBP',
  'upload.change': 'החלפה',
  'upload.reset': 'איפוס מיקום',
  'upload.zoom': 'זום',
  'upload.dragHint': 'לאחר ההעלאה, גררו למיקום והשתמשו בזום.',
  'upload.errorType': 'אנא בחרו תמונת JPG, PNG או WEBP.',
  'upload.errorGeneric': 'מצטערים — לא ניתן היה לטעון את התמונה.',

  'image.a.badge': 'A',
  'image.a.name': 'מבט משמאל',
  'image.b.badge': 'B',
  'image.b.name': 'מבט מימין',

  'controls.title': 'הגדרות',
  'controls.slices': 'מספר הפרוסות',
  'controls.slicesHelp': 'לכמה רצועות נחתכת כל תמונה.',
  'controls.angle': 'זווית הקיפול',
  'controls.angleHelp': 'הזווית של כל קיפול אקורדיון.',
  'controls.size': 'גודל סופי',
  'controls.width': 'רוחב',
  'controls.height': 'גובה',
  'controls.custom': 'מותאם אישית…',
  'controls.portrait': 'לאורך',
  'controls.landscape': 'לרוחב',
  'controls.margins': 'שוליים',
  'controls.marginsHelp': 'מסגרת לבנה בקצה הימני והשמאלי, עם קו חיתוך אפור לגזירה.',
  'controls.marginsWidth': 'רוחב השוליים',
  'controls.dividers': 'קווי קיפול',
  'controls.dividersHelp': 'הדפסת קו דק בין כל שתי רצועות.',
  'controls.dividersWidth': 'עובי הקו',
  'controls.dividersColor': 'צבע',
  'controls.dividersAuto': 'אוטומטי (בלתי נראה)',
  'controls.dividersAutoHelp':
    'כל קו מקבל את צבעי שתי הרצועות שסביבו, כך שקווי הקיפול נעלמים בתוך התמונה.',

  'section.slicesAngle': 'פרוסות וזווית',
  'section.slicesAngleDesc': 'כמה רצועות ובאיזו זווית מתקפלת היצירה',
  'section.size': 'גודל הדפסה',
  'section.sizeDesc': 'הגודל הסופי של היצירה על הקיר',
  'section.dimensionsDesc': 'המידות המחושבות והקובץ להדפסה',
  'section.livePreview': 'תצוגה חיה',
  'section.livePreviewDesc': 'מתעדכן עם כל שינוי',
  'section.detailsDesc': 'שחזור כל צד ופרופיל הקיפול',
  'section.profileDesc': 'חתך צדי של הקיפול — זווית, רוחב ועומק',

  'common.enable': 'הפעלה',

  'unit.cm': 'ס״מ',
  'unit.mm': 'מ״מ',

  'profile.title': 'פרופיל הקיפול (חתך)',
  'profile.wall': 'קיר',
  'profile.aFaces': 'פאות A',
  'profile.bFaces': 'פאות B',
  'profile.repeats': 'חוזר ×{n} קיפולים',
  'profile.unitsNote': 'המידות בס״מ',

  'dims.title': 'מידות',
  'dims.finished': 'גודל סופי מקופל על הקיר',
  'dims.flatSheet': 'גיליון שטוח (להדפסה)',
  'dims.flatSheetHelp':
    'הגיליון השטוח רחב מהיצירה המוגמרת — הקיפול בולע את הרוחב העודף.',
  'dims.foldDepth': 'עומק הקיפול',
  'dims.strips': 'רצועות',
  'dims.stripsValue': '{total} בסך הכול ({n} לכל תמונה)',
  'dims.stripWidth': 'רוחב רצועה',
  'dims.printFile': 'קובץ להדפסה',

  'preview.flat': 'גיליון להדפסה',
  'preview.flatHelp': 'זה מה שמודפס. קפלו לאקורדיון לאורך הקווים.',
  'preview.reconstructionTitle': 'איך נראה כל צד',
  'preview.left': 'מבט משמאל (A)',
  'preview.right': 'מבט מימין (B)',
  'preview.needImageA': 'העלו תמונה A',
  'preview.needImageB': 'העלו תמונה B',
  'preview.3d': 'תצוגת תלת־ממד',
  'preview.3dHelp': 'גררו שמאלה וימינה כדי לחלוף על פני היצירה.',
  'preview.3dLoading': 'טוען תצוגת תלת־ממד…',
  'preview.needBoth': 'העלו את שתי התמונות כדי לראות תצוגה מקופלת.',
  'preview.save3d': 'שמירת התצוגה כ-JPG',

  'export.title': 'ייצוא',
  'export.format': 'סוג קובץ',
  'export.dpi': 'איכות (DPI)',
  'export.filename': 'שם הקובץ',
  'export.button': 'ייצוא קובץ להדפסה',
  'export.busy': 'מייצא…',
  'export.needBoth': 'העלו את שתי התמונות כדי לייצא.',
  'export.hint': 'שומר את הגיליון השטוח, מוכן להדפסה ולקיפול.',
  'export.error': 'מצטערים — הייצוא נכשל. נסו שוב.',
}

export const languages: Record<string, Language> = {
  en: { code: 'en', dir: 'ltr', strings: en },
  he: { code: 'he', dir: 'rtl', strings: he },
}

/** The single switch that selects the active UI language. */
export const activeLanguage: Language = languages.he
