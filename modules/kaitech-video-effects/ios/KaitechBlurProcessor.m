#import <CoreImage/CoreImage.h>
#import <Foundation/Foundation.h>
#import <LiveKitWebRTC/RTCCVPixelBuffer.h>
#import <LiveKitWebRTC/RTCVideoFrame.h>
#import <Vision/Vision.h>
#import "LKRNProcessorProvider.h"

static NSString *const KaitechBlurName = @"kaitechBackgroundBlur";
static const NSUInteger KaitechSegmentEvery = 3;

@interface KaitechBlurProcessor : NSObject <LKRNVideoFrameProcessorDelegate>
@end

@implementation KaitechBlurProcessor {
  CIContext *_context;
  VNGeneratePersonSegmentationRequest *_request;
  VNSequenceRequestHandler *_handler;
  CIImage *_mask;
  NSUInteger _count;
}

+ (void)load {
  [LKRNProcessorProvider addProcessor:[KaitechBlurProcessor new] forName:KaitechBlurName];
}

- (instancetype)init {
  if ((self = [super init])) {
    _context = [CIContext contextWithOptions:nil];
    _request = [VNGeneratePersonSegmentationRequest new];
    _request.qualityLevel = VNGeneratePersonSegmentationRequestQualityLevelBalanced;
    _request.outputPixelFormat = kCVPixelFormatType_OneComponent8;
    _handler = [VNSequenceRequestHandler new];
  }
  return self;
}

- (LKRTCVideoFrame *)capturer:(LKRTCVideoCapturer *)capturer didCaptureVideoFrame:(LKRTCVideoFrame *)frame {
  if (![frame.buffer isKindOfClass:[LKRTCCVPixelBuffer class]]) return frame;
  CVPixelBufferRef source = ((LKRTCCVPixelBuffer *)frame.buffer).pixelBuffer;
  CIImage *original = [CIImage imageWithCVPixelBuffer:source];
  CGRect extent = original.extent;
  if (_mask == nil || _count % KaitechSegmentEvery == 0) {
    if ([_handler performRequests:@[ _request ] onCVPixelBuffer:source error:nil]) {
      VNPixelBufferObservation *observation = _request.results.firstObject;
      if (observation != nil) {
        CIImage *mask = [CIImage imageWithCVPixelBuffer:observation.pixelBuffer];
        _mask = [mask imageByApplyingTransform:CGAffineTransformMakeScale(extent.size.width / mask.extent.size.width, extent.size.height / mask.extent.size.height)];
      }
    }
  }
  _count += 1;
  CIImage *blurred = [[[original imageByClampingToExtent] imageByApplyingGaussianBlurWithSigma:18] imageByCroppingToRect:extent];
  CIImage *output = blurred;
  if (_mask != nil) {
    CIFilter *blend = [CIFilter filterWithName:@"CIBlendWithMask"];
    [blend setValue:original forKey:kCIInputImageKey];
    [blend setValue:blurred forKey:kCIInputBackgroundImageKey];
    [blend setValue:_mask forKey:kCIInputMaskImageKey];
    output = blend.outputImage ?: blurred;
  }
  CVPixelBufferRef target = NULL;
  NSDictionary *attributes = @{(id)kCVPixelBufferIOSurfacePropertiesKey : @{}};
  if (CVPixelBufferCreate(kCFAllocatorDefault, CVPixelBufferGetWidth(source), CVPixelBufferGetHeight(source), CVPixelBufferGetPixelFormatType(source), (__bridge CFDictionaryRef)attributes, &target) != kCVReturnSuccess) {
    return frame;
  }
  [_context render:output toCVPixelBuffer:target];
  LKRTCCVPixelBuffer *buffer = [[LKRTCCVPixelBuffer alloc] initWithPixelBuffer:target];
  CVPixelBufferRelease(target);
  return [[LKRTCVideoFrame alloc] initWithBuffer:buffer rotation:frame.rotation timeStampNs:frame.timeStampNs];
}

@end
