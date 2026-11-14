# Письма с кодом для регистрации v2

v2 просит код из письма (длина — «Email OTP length» в Supabase, сейчас 8 цифр; приложение принимает 6–10), а стандартные письма Supabase присылают ссылку. Вставь эти тексты в
панели Supabase: **Authentication → Emails → Templates**.

## «Change Email Address» (регистрация гостя: почта привязывается к его аккаунту)

Тема: `Код SUSHHH: {{ .Token }}`

```html
<p>Твой код для SUSHHH: <b style="font-size:22px;letter-spacing:4px">{{ .Token }}</b></p>
<p>Введи его в приложении. Код действует 1 час.</p>
<p>Если ты не просил код — просто удали это письмо.</p>
<hr />
<p>Your SUSHHH code: <b>{{ .Token }}</b>. It works for 1 hour. If you didn't ask for it, ignore this email.</p>
```

## «Magic Link» (вход в уже зарегистрированный аккаунт на новом устройстве)

Тема: `Код SUSHHH: {{ .Token }}`

Тот же текст, что выше.

## Почта для отправки

Встроенная почта Supabase шлёт письма только участникам проекта и несколько писем в час — для
проверки на себе хватит. Для настоящих людей нужен свой сервис рассылки (например, Resend) и домен:
**Authentication → Emails → SMTP Settings**.
