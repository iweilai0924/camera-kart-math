# 第三方元件與素材

| 項目 | 位置 | 來源 | 授權 |
|---|---|---|---|
| YOLOv8-pose 姿態辨識模型（ONNX） | `models/yolov8s-pose.onnx`、`models/yolov8n-pose.onnx` | [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics)，ONNX 版取自 [Xenova 在 Hugging Face 的轉檔](https://huggingface.co/Xenova) | AGPL-3.0 |
| ONNX Runtime Web | `vendor/ort/` | [microsoft/onnxruntime](https://github.com/microsoft/onnxruntime) | MIT |
| 車子、角色、道具、賽道背景與路邊物件的圖 | `assets/race/` | 以 AI 影像生成工具製作的原創設計，再去背裁切 | 隨本專案以 AGPL-3.0 提供 |

因為姿態辨識模型是 AGPL-3.0 授權，整個專案也以 AGPL-3.0 公開。
如果你想把這個遊戲用在不公開原始碼的產品裡，需要把模型換成授權較寬鬆的姿態模型（例如 Apache-2.0 的 RTMO），或向 Ultralytics 取得商業授權。
