import translators as ts

text_de = "Guten Tag! Wie geht es dir?"
text_en = "Hi! How are you?"

# Обязательно указываем движок 'bing'
# de = немецкий, hsb = верхнелужицкий
text_hsb = ts.translate_text(
    text_de,
    from_language='en',
    to_language='dsb',
    translator='bing'
)

print("Перевод:", text_hsb)
