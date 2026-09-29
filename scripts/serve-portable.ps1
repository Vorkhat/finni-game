param([int]$Port = 18765, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$webRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../apps/web/dist'))
if (!(Test-Path -LiteralPath (Join-Path $webRoot 'index.html'))) { throw 'Game build is missing: apps/web/dist/index.html' }
$rootPrefix = $webRoot + [IO.Path]::DirectorySeparatorChar
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.json'='application/json'; '.png'='image/png'; '.webp'='image/webp'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.mp3'='audio/mpeg'; '.wav'='audio/wav'; '.woff2'='font/woff2'; '.woff'='font/woff'; '.ttf'='font/ttf' }
$listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { throw "Cannot open port $Port. Close the other Finni launch window and try again. $($_.Exception.Message)" }
$url = "http://127.0.0.1:$Port"
Write-Host "Finni is running: $url"
Write-Host 'Keep this window open while playing. Close it to stop the game server.'
if (!$NoBrowser) { Start-Process $url }
try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $fileStream = $null
    try {
      $stream = $client.GetStream()
      $stream.ReadTimeout = 3000
      $stream.WriteTimeout = 15000
      $request = New-Object Text.StringBuilder
      while ($request.Length -lt 32768) {
        $byte = $stream.ReadByte()
        if ($byte -lt 0) { break }
        [void]$request.Append([char]$byte)
        if ($request.Length -ge 4 -and $request.ToString($request.Length - 4, 4) -eq "`r`n`r`n") { break }
      }
      $parts = ($request.ToString() -split "`r`n", 2)[0] -split ' '
      if ($parts.Length -lt 2) { continue }
      $method = $parts[0]
      $requestPath = [Uri]::UnescapeDataString(($parts[1] -split '\?', 2)[0])
      $filePath = [IO.Path]::GetFullPath((Join-Path $webRoot $requestPath.TrimStart('/')))
      $status = '200 OK'
      $contentType = 'text/plain; charset=utf-8'
      $body = [Text.Encoding]::UTF8.GetBytes('Not found')
      if ($method -notin @('GET','HEAD')) { $status = '405 Method Not Allowed' }
      elseif ($filePath -ne $webRoot -and !$filePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { $status = '403 Forbidden' }
      else {
        if (!(Test-Path -LiteralPath $filePath -PathType Leaf) -and [IO.Path]::GetExtension($filePath) -eq '') { $filePath = Join-Path $webRoot 'index.html' }
        if (Test-Path -LiteralPath $filePath -PathType Leaf) {
          $fileStream = [IO.File]::OpenRead($filePath)
          $contentType = $mime[[IO.Path]::GetExtension($filePath).ToLowerInvariant()]
          if (!$contentType) { $contentType = 'application/octet-stream' }
        } else { $status = '404 Not Found' }
      }
      $length = if ($fileStream) { $fileStream.Length } else { $body.Length }
      $headers = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $length`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`n`r`n")
      $stream.Write($headers, 0, $headers.Length)
      if ($method -ne 'HEAD') {
        if ($fileStream) { $fileStream.CopyTo($stream) } else { $stream.Write($body, 0, $body.Length) }
      }
    } catch {
      # Browsers can cancel downloads or preconnect without sending a request.
      Write-Verbose $_.Exception.Message
    } finally {
      if ($fileStream) { $fileStream.Dispose() }
      $client.Close()
    }
  }
} finally { $listener.Stop() }
