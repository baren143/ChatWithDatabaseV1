import requests, os
url='http://127.0.0.1:8000/api/upload'
with open('test.xlsx','rb') as f:
    files={'file':f}
    resp=requests.post(url, files=files)
print('status', resp.status_code)
print('response', resp.text)
