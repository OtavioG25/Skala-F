# Skala Financeiro - Backup Supabase
# Uso: clique com botao direito -> "Executar com PowerShell"

$URL = "https://rvymfrpugzwwgrcybwpk.supabase.co"
$KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2eW1mcnB1Z3p3d2dyY3lid3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODgzNTUsImV4cCI6MjA5MzA2NDM1NX0.kgWgFOlD53kclwB62GPOHbQh55Ypxp6rjGhYCmvs-Us"
$TABELAS = @("lancamentos","categorias","subcategorias","recorrentes","contas","baixas_lancamentos","projecoes_manuais","clientes")

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKUP_DIR = Join-Path $SCRIPT_DIR "backups"
if (-not (Test-Path $BACKUP_DIR)) { New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null }
$TIMESTAMP = Get-Date -Format "yyyy-MM-dd_HH-mm"
$DEST = Join-Path $BACKUP_DIR $TIMESTAMP
New-Item -ItemType Directory -Path $DEST | Out-Null

Write-Host ""
Write-Host "======================================="
Write-Host "  Skala Financeiro - Backup Supabase"
Write-Host "======================================="
Write-Host ""

$EMAIL = Read-Host "Email do Supabase"
$SENHA = Read-Host "Senha"

Write-Host ""
Write-Host "Autenticando..."

$BODY = '{"email":"' + $EMAIL + '","password":"' + $SENHA + '"}'
try {
    $AUTH = Invoke-RestMethod `
        -Uri "$URL/auth/v1/token?grant_type=password" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{ "apikey" = $KEY } `
        -Body $BODY
} catch {
    Write-Host "ERRO ao autenticar. Verifique email e senha." -ForegroundColor Red
    Write-Host $_.Exception.Message
    Read-Host "Pressione Enter para sair"
    exit 1
}

$JWT = $AUTH.access_token
Write-Host "Autenticado com sucesso." -ForegroundColor Green

$TOTAL = 0
foreach ($TAB in $TABELAS) {
    Write-Host ""
    Write-Host "Exportando $TAB..."
    $TODOS = [System.Collections.Generic.List[object]]::new()
    $FROM = 0
    $SIZE = 1000
    do {
        $URI = "$URL/rest/v1/" + $TAB + "?select=*&limit=$SIZE&offset=$FROM"
        try {
            $RESP = Invoke-RestMethod `
                -Uri $URI `
                -Method GET `
                -Headers @{
                    "apikey"        = $KEY
                    "Authorization" = "Bearer $JWT"
                    "Prefer"        = "count=none"
                }
            if ($RESP -isnot [System.Array]) { $RESP = @($RESP) }
            foreach ($item in $RESP) { $TODOS.Add($item) }
        } catch {
            Write-Host "  ERRO na tabela '$TAB': $($_.Exception.Message)" -ForegroundColor Red
            $RESP = @()
        }
        $FROM += $SIZE
    } while ($RESP.Count -eq $SIZE)

    $ARQUIVO = Join-Path $DEST "$TAB.json"
    $TODOS | ConvertTo-Json -Depth 10 | Out-File -FilePath $ARQUIVO -Encoding utf8
    Write-Host "  $($TODOS.Count) registros -> $TAB.json" -ForegroundColor Green
    $TOTAL += $TODOS.Count
}

Write-Host ""
Write-Host "======================================="
Write-Host "  Backup concluido! $TOTAL registros"
Write-Host "  $DEST"
Write-Host "======================================="
Write-Host ""
Read-Host "Pressione Enter para fechar"
