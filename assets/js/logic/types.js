/**
 * @typedef {Object} Vertex
 * @property {string} id
 * @property {string} name
 * @property {number} x
 * @property {number} y
 * @property {boolean} isAnglePoint
 * @property {number=} originalIndex
 */

/**
 * @typedef {Object} ArcInfo
 * @property {{x:number,y:number}} arcPoint
 * @property {number} arcHei
 * @property {number=} arcLength
 * @property {number=} radius
 */

/**
 * @typedef {Object} Segment
 * @property {string} id
 * @property {number} startIndex
 * @property {number} endIndex
 * @property {number} length
 * @property {boolean} hasArc
 * @property {ArcInfo=} arcInfo
 * @property {number=} jValue
 */

/**
 * @typedef {Object} Contour
 * @property {string} id
 * @property {string} name
 * @property {'outer'|'cutout'|'zone'} type
 * @property {Vertex[]} vertices
 * @property {Segment[]} segments
 * @property {ArcInfo[]} arcs
 * @property {Object} metadata
 * @property {boolean} isProcessed
 * @property {boolean} isProcessedEligible
 */

/**
 * @typedef {Object} Transformation
 * @property {string} id
 * @property {'SKIPPED_COLUMN'|'SKIPPED_SHORT_SEGMENT'|'SPLIT_SHORT_SEGMENT'|'SPLIT_BOTH_SEGMENTS'} type
 * @property {number} vertexIndex
 * @property {string} vertexName
 * @property {number} angleDegrees
 * @property {number} prevSegmentIndex
 * @property {number} nextSegmentIndex
 * @property {number} prevSegmentLength
 * @property {number} nextSegmentLength
 * @property {number=} incrementMm
 * @property {number=} incrementPercent
 * @property {Vertex=} newVertex
 * @property {boolean} fallbackUsed
 * @property {string=} reason
 */

/**
 * @typedef {Object} ProcessingResult
 * @property {string} contourId
 * @property {boolean} wasModified
 * @property {number} internalAnglesFound
 * @property {number} internalAnglesProcessed
 * @property {number} internalAnglesSkipped
 * @property {Transformation[]} transformations
 * @property {number} stretchParamPer
 * @property {number} stretchParamPer2
 */

/**
 * @typedef {Object} ProcessingError
 * @property {string} code
 * @property {string} message
 * @property {string=} contourId
 * @property {number=} vertexIndex
 * @property {'warning'|'error'} severity
 */

/**
 * @typedef {Object} ProcessingLog
 * @property {string} timestamp
 * @property {string} fileName
 * @property {number} totalContours
 * @property {number} totalVertices
 * @property {ProcessingResult[]} results
 * @property {ProcessingError[]} errors
 * @property {number} durationMs
 */

export {};
