# auto-commit.ps1
# Salva automaticamente qualquer alteração não-commitada no git.
# Configure no Agendador de Tarefas do Windows para rodar a cada hora.

$projectPath = "c:\Users\Edenir-W10\OneDrive - SKALA CONTABILIDADE LTDA\Skala ADM Drive\Otávio\Financeiro APP"
$logFile = "$projectPath\auto-commit.log"

Set-Location $projectPath

# Verifica se há alterações não-commitadas
$status = git status --porcelain 2>&1
if (-not $status) {
    exit 0  # Nada a fazer
}

# Commit automático com timestamp
$timestamp = Get-Date -Format "dd/MM/yyyy HH:mm"
git add -A
git commit -m "auto-save: $timestamp"

# Push silencioso (sem interromper em caso de erro de rede)
git push origin main 2>&1 | Out-Null

# Log da operação
"[$timestamp] auto-commit executado" | Add-Content $logFile
