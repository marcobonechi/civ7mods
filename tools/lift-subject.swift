// Usage: swift tools/lift-subject.swift <in image> <out cutout png>
// Lifts the foreground subject (Vision subject lifting) and prints the face box in
// top-left pixel coordinates: "face x y w h".
import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
let url = URL(fileURLWithPath: args[1])
guard let ci = CIImage(contentsOf: url) else { fatalError("cannot read \(args[1])") }
let W = ci.extent.width, H = ci.extent.height
let handler = VNImageRequestHandler(ciImage: ci)

let lift = VNGenerateForegroundInstanceMaskRequest()
let face = VNDetectFaceRectanglesRequest()
try handler.perform([lift, face])

guard let obs = lift.results?.first else { fatalError("no subject found") }
let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: false)
let out = CIImage(cvPixelBuffer: buf)
let ctx = CIContext()
try ctx.writePNGRepresentation(of: out, to: URL(fileURLWithPath: args[2]), format: .RGBA8,
                               colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)

if let f = face.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
    let b = f.boundingBox
    print(String(format: "face %.0f %.0f %.0f %.0f", b.minX * W, (1 - b.maxY) * H, b.width * W, b.height * H))
} else {
    print("face none")
}
