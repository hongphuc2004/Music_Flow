/// Tiện ích chuyển đổi chuỗi tiếng Việt có dấu sang URL slug chuẩn (kebab-case)
String slugify(String text) {
  var str = text.toLowerCase().trim();
  const vietnameseMap = {
    'a': 'áàảãạâấầẩẫậăắằẳẵặ',
    'd': 'đ',
    'e': 'éèẻẽẹêếềểễệ',
    'i': 'íìỉĩị',
    'o': 'óòỏõọôốồổỗộơớờởỡợ',
    'u': 'úùủũụưứừửữự',
    'y': 'ýỳỷỹỵ',
  };

  vietnameseMap.forEach((replacement, chars) {
    for (var i = 0; i < chars.length; i++) {
      str = str.replaceAll(chars[i], replacement);
    }
  });

  str = str.replaceAll('&', ' and ');
  str = str.replaceAll(RegExp(r'[^a-z0-9\s-]'), '');
  str = str.replaceAll(RegExp(r'\s+'), '-');
  str = str.replaceAll(RegExp(r'-+'), '-');
  return str.replaceAll(RegExp(r'^-+|-+$'), '');
}
