// Reads text out of an image with the system Vision framework.
//
// Why this exists: the screenshots this project compares against are other
// applications' windows, and a vision model is not always available (rate
// limits are common). Vision is on every Mac, needs no network, and returns
// text with bounding boxes, which is enough to tell which surface a window is
// showing without looking at the picture.
//
// usage:
//   swift scripts/image-ocr.swift IMAGE [--min-confidence 0.3]
//
// Output is one line per recognised run:
//   x=<x> y=<y> w=<w> h=<h>  <text>
// with x/y/w/h as fractions of the image, so the caller can group runs into
// rows and columns without knowing the capture scale.

import Foundation
import Vision
import AppKit

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write(Data("usage: image-ocr.swift IMAGE [--min-confidence N]\n".utf8))
    exit(2)
}

var minConfidence: Float = 0
if let index = args.firstIndex(of: "--min-confidence"), let raw = args[safe: index + 1], let value = Float(raw) {
    minConfidence = value
}

guard let image = NSImage(contentsOfFile: args[1]),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write(Data("cannot read image: \(args[1])\n".utf8))
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = false
// Thai windows are a real target for this project, so both scripts are asked
// for; Vision returns whichever it actually matched.
request.recognitionLanguages = ["en-US", "th-TH"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    FileHandle.standardError.write(Data("vision failed: \(error)\n".utf8))
    exit(1)
}

let observations = (request.results ?? []).sorted { left, right in
    // Reading order: top to bottom, then left to right.
    if abs(left.boundingBox.midY - right.boundingBox.midY) > 0.006 {
        return left.boundingBox.midY > right.boundingBox.midY
    }
    return left.boundingBox.minX < right.boundingBox.minX
}

var emitted = 0
for observation in observations {
    guard let candidate = observation.topCandidates(1).first else { continue }
    if candidate.confidence < minConfidence { continue }
    let box = observation.boundingBox
    let text = candidate.string.replacingOccurrences(of: "\n", with: " ")
    print(String(
        format: "x=%.3f y=%.3f w=%.3f h=%.3f  %@",
        box.minX, 1.0 - box.maxY, box.width, box.height, text
    ))
    emitted += 1
}

FileHandle.standardError.write(Data("\(emitted) runs from \(cgImage.width)x\(cgImage.height)\n".utf8))
