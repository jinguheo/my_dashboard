#!/usr/bin/env python3
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

from stock_mcp_server import _sapi_tts_wav

app = Flask(__name__)
CORS(app)


@app.route('/avatar/tts_only', methods=['POST'])
def avatar_tts_only():
    payload = request.get_json(silent=True) if request.is_json else {}
    text = (request.form.get('text') or (payload or {}).get('text') or '').strip()
    voice = request.form.get('voice') or (payload or {}).get('voice') or 'mine'
    if not text:
        return jsonify({'error': 'text가 비어 있습니다.'}), 400
    try:
        audio = _sapi_tts_wav(text, voice)
        return Response(audio, mimetype='audio/wav')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=8767, debug=False, threaded=True)
