[CmdletBinding()]
param (
    [string]$Hostname = 'saraya.local',
    [int]$HttpsPort = 18443,
    [int]$TimeoutSeconds = 60,
    [int]$RetryIntervalSeconds = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    Write-Output "Starting health check verification..."

    $readyUrl = "http://127.0.0.1:4000/api/v1/system/health/ready"
    $liveUrl = "http://127.0.0.1:4000/api/v1/system/health/live"
    
    $startTime = Get-Date
    $ready = $false
    $responseData = $null

    while (($((Get-Date) - $startTime).TotalSeconds) -lt $TimeoutSeconds) {
        try {
            Write-Output "Checking API readiness at $readyUrl..."
            $response = Invoke-RestMethod -Uri $readyUrl -Method Get -ErrorAction Stop
            if ($response -and $response.status -eq 'ready') {
                $responseData = $response
                $ready = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds $RetryIntervalSeconds
        }
    }

    if (-not $ready) {
        throw "Timed out waiting for API to become ready on port 4000"
    }

    Write-Output "API is ready. Checking liveness at $liveUrl..."
    $liveResponse = Invoke-RestMethod -Uri $liveUrl -Method Get -ErrorAction Stop
    if ($liveResponse.status -ne 'ok') {
        throw "Liveness check returned unexpected status: $($liveResponse.status)"
    }

    Write-Output "Checking Caddy HTTPS listener on port $HttpsPort..."
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $tcpClient.BeginConnect('127.0.0.1', $HttpsPort, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne(5000)) {
            throw "Timed out connecting to Caddy HTTPS on port $HttpsPort"
        }
        $tcpClient.EndConnect($connect)
    }
    finally {
        $tcpClient.Dispose()
    }

    Write-Output "========================================="
    Write-Output "Health Check Passed: All Services Healthy"
    Write-Output "========================================="
    exit 0
}
catch {
    Write-Error "Health check failed: $($_.Exception.Message)"
    exit 1
}
