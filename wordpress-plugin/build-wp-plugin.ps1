param(
    [string]$Destination = "kobara-woocommerce.zip"
)

# Remove the old zip if it exists
if (Test-Path $Destination) {
    Remove-Item $Destination
}

# Compress the plugin directory properly using tar to avoid Windows backslash issues
Write-Host "Creating $Destination..."
tar.exe -a -c -f $Destination kobara-wordpress-plugin

Write-Host "Done! You can now upload $Destination to WordPress."
