# Load .env file and set environment variables
$envFile = "apps/server/.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "^(?<name>[^#\s=]+)=(?<value>.*)$") {
            $name = $Matches['name']
            $value = $Matches['value'].Trim()
            # Remove quotes if present
            if ($value -match "^['""](.*)['""]$") {
                $value = $Matches[1]
            }
            [System.Environment]::SetEnvironmentVariable($name, $value)
            Write-Host "Setting $name"
        }
    }
} else {
    Write-Error ".env file not found at $envFile"
    exit 1
}

# Run the test script
bun run apps/server/scripts/test-document-recommendation.ts
