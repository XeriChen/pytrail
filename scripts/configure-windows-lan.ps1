#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

$profile = Get-NetConnectionProfile |
    Where-Object { $_.IPv4Connectivity -eq "Internet" } |
    Select-Object -First 1

if (-not $profile) {
    throw "No active IPv4 network profile found."
}

if ($profile.NetworkCategory -ne "Private") {
    Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Private
}

$rules = @(
    @{ Name = "PyTrail Web 5173"; Port = 5173 },
    @{ Name = "PyTrail API 8000"; Port = 8000 }
)

foreach ($rule in $rules) {
    $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
    if ($existing) {
        Set-NetFirewallRule -DisplayName $rule.Name -Enabled True -Direction Inbound -Action Allow -Profile Private
        Set-NetFirewallPortFilter -AssociatedNetFirewallRule $existing -Protocol TCP -LocalPort $rule.Port
        Set-NetFirewallAddressFilter -AssociatedNetFirewallRule $existing -RemoteAddress LocalSubnet
    } else {
        New-NetFirewallRule `
            -DisplayName $rule.Name `
            -Direction Inbound `
            -Action Allow `
            -Profile Private `
            -Protocol TCP `
            -LocalPort $rule.Port `
            -RemoteAddress LocalSubnet | Out-Null
    }
}

Get-NetConnectionProfile |
    Select-Object InterfaceIndex, InterfaceAlias, Name, NetworkCategory, IPv4Connectivity
Get-NetFirewallRule -DisplayName "PyTrail Web 5173", "PyTrail API 8000" |
    Select-Object DisplayName, Enabled, Direction, Action, Profile
