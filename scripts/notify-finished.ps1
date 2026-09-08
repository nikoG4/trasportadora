param(
  [string]$Message = "Transportadora: trabajo terminado.",
  [string]$Subject = "Transportadora lista",
  [string]$EmailTo = $env:NOTIFY_EMAIL_TO,
  [string]$WhatsappTo = $env:NOTIFY_WHATSAPP_TO
)

$ErrorActionPreference = "Stop"

function Send-TelegramNotification {
  if (-not $env:TELEGRAM_BOT_TOKEN -or -not $env:TELEGRAM_CHAT_ID) {
    return $false
  }

  $body = @{
    chat_id = $env:TELEGRAM_CHAT_ID
    text = $Message
  }

  Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/sendMessage" `
    -ContentType "application/json" `
    -Body ($body | ConvertTo-Json -Compress) | Out-Null

  Write-Host "Telegram enviado."
  return $true
}

function Send-EmailNotification {
  if (-not $EmailTo -or -not $env:SMTP_HOST -or -not $env:SMTP_USER -or -not $env:SMTP_PASS) {
    return $false
  }

  $smtpPort = if ($env:SMTP_PORT) { [int]$env:SMTP_PORT } else { 587 }
  $from = if ($env:SMTP_FROM) { $env:SMTP_FROM } else { $env:SMTP_USER }
  $securePassword = ConvertTo-SecureString $env:SMTP_PASS -AsPlainText -Force
  $credential = [PSCredential]::new($env:SMTP_USER, $securePassword)

  Send-MailMessage `
    -SmtpServer $env:SMTP_HOST `
    -Port $smtpPort `
    -UseSsl `
    -Credential $credential `
    -From $from `
    -To $EmailTo `
    -Subject $Subject `
    -Body $Message `
    -Encoding UTF8

  Write-Host "Correo enviado."
  return $true
}

function Send-TwilioWhatsappNotification {
  if (-not $WhatsappTo -or -not $env:TWILIO_ACCOUNT_SID -or -not $env:TWILIO_AUTH_TOKEN -or -not $env:TWILIO_WHATSAPP_FROM) {
    return $false
  }

  $pair = "$($env:TWILIO_ACCOUNT_SID):$($env:TWILIO_AUTH_TOKEN)"
  $bytes = [Text.Encoding]::ASCII.GetBytes($pair)
  $basic = [Convert]::ToBase64String($bytes)

  $form = @{
    From = $env:TWILIO_WHATSAPP_FROM
    To = $WhatsappTo
    Body = $Message
  }

  Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.twilio.com/2010-04-01/Accounts/$($env:TWILIO_ACCOUNT_SID)/Messages.json" `
    -Headers @{ Authorization = "Basic $basic" } `
    -Body $form | Out-Null

  Write-Host "WhatsApp enviado."
  return $true
}

$sent = $false

try { $sent = (Send-TelegramNotification) -or $sent } catch { Write-Warning "Telegram fallo: $($_.Exception.Message)" }
try { $sent = (Send-EmailNotification) -or $sent } catch { Write-Warning "Correo fallo: $($_.Exception.Message)" }
try { $sent = (Send-TwilioWhatsappNotification) -or $sent } catch { Write-Warning "WhatsApp fallo: $($_.Exception.Message)" }

if (-not $sent) {
  Write-Host "No se envio notificacion porque faltan credenciales o destinos."
  Write-Host "Telegram: TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID."
  Write-Host "Correo: NOTIFY_EMAIL_TO, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y opcional SMTP_FROM."
  Write-Host "WhatsApp Twilio: NOTIFY_WHATSAPP_TO, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM."
  exit 2
}
