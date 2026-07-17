Set shell = CreateObject("WScript.Shell")
shell.Run """D:\MyWork\my-dashboard\start_dashboard_startup.bat""", 0, True
WScript.Sleep 12000
shell.Run "http://localhost:5173/", 1, False
