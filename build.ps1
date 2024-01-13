[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory=$false)]
    [string]
    $RootDirectory,

    [Parameter(Mandatory=$false)]
    [string]
    $OutPath,

    [Parameter(Mandatory=$false)]
    [switch]
    $DryRun
)

function Test-FileExists {
    param(
        [Parameter(Mandatory=$true,
                   Position=0,
                   ParameterSetName="Path",
                   ValueFromPipeline=$true,
                   ValueFromPipelineByPropertyName=$true,
                   HelpMessage="Path to one or more locations.")]
        [Alias("PSPath")]
        [ValidateNotNullOrEmpty()]
        [string[]]
        $Path,

        [Parameter(Mandatory=$false,
                   Position=1)]
        [ValidateNotNull()]
        [string]
        $Message
    )

    if (!(Test-Path -LiteralPath $Path)) {
        $msg = ($null -ne $Message) ? $Message : "Required file does not exist: $Path"
        $ex = New-Object System.Management.Automation.ItemNotFoundException $msg
        $category = [System.Management.Automation.ErrorCategory]::ObjectNotFound
        $errRecord = New-Object System.Management.Automation.ErrorRecord $ex,'PathNotFound',$category,$Path

        $PSCmdlet.WriteError($errRecord)

        return $false;
    }

    return $true;
}

$srcDir = Join-Path -Path . -ChildPath .\src\
$distDir = Join-Path -Path . -ChildPath .\dist\

$scriptName = "tooltips.js"
$headerTemplateName = "userscript_header.js"
$headerValuesName = "userscript_header.values.json"
$outputName = "tooltips.user.js"

$scriptPath = Join-Path -Path $srcDir -ChildPath $scriptName
$headerTemplatePath = Join-Path -Path $srcDir -ChildPath $headerTemplateName
$headerValuesPath = Join-Path -Path $srcDir -ChildPath $headerValuesName
$outputPath = Join-Path -Path $distDir -ChildPath $outputName

Write-Host "Building script from:"
Write-Host "-->  $scriptPath"
Write-Host "-->  $headerTemplatePath"
Write-Host "-->  $headerValuesPath"
Write-Host ""

$filesExist = (Test-FileExists -Path $scriptPath -Message "Cant find userscript file at path '$scriptPath'") -and
                (Test-FileExists -Path $headerTemplatePath -Message "Cant find header template file at path '$headerTemplatePath'") -and
                (Test-FileExists -Path $headerValuesPath -Message "Cant find header values file at '$headerValuesPath'")

if (!$filesExist) {
    Write-Error "Build failed. Required files could not be found."
}

$scriptText = Get-Content -Path $scriptPath -Raw
$headerTemplateText = Get-Content -Path $headerTemplatePath -Raw
$headerValuesJson = Get-Content -Path $headerValuesPath -Raw
$headerValuesHash = ConvertFrom-Json -InputObject $headerValuesJson -AsHashtable

$versionValue = Get-Date -Format "yyyy-MM-dd_HH-mm"
$headerValuesHash.Add("version", $versionValue)

Write-Host "Creating userscript header..."

foreach ($kv in $headerValuesHash.GetEnumerator()) {
    $key = $($kv.Key)
    $value = $($kv.Value)
    $placeholder = "{{$key}}"

    Write-Host "-->  $key : $value"

    $headerTemplateText = $headerTemplateText.Replace($placeholder, $value)
}

Write-Host ""

if (!(Test-Path -LiteralPath $distDir)) {
    Write-Host "Creating output directory: $distDir"

    New-Item -ItemType Directory -Name "dist" -Path .
}

$outputText = $headerTemplateText + [Environment]::NewLine + [Environment]::NewLine + $scriptText
Out-File -FilePath $outputPath -Encoding utf8 -InputObject $outputText

Write-Host "Build complete: $outputPath"
