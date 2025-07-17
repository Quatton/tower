import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

const SIZE = 100;
const WORKGROUP_SIZE = 10;
const STEP_INTERVAL_MS = 100;

const computeShader = /* wgsl */ `
@group(0) @binding(0) var<storage, read> currentGrid: array<u32>;
@group(0) @binding(1) var<storage, read_write> nextGrid: array<u32>;
@compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
fn conway(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= ${SIZE}u || id.y >= ${SIZE}u) {
    return;
  }
  
  let index = id.x + id.y * ${SIZE}u;
  let cell = currentGrid[index];
  var neighbors = 0u;
  
  // Check all 8 neighbors with proper bounds checking
  for (var dx = -1i; dx <= 1i; dx = dx + 1i) {
    for (var dy = -1i; dy <= 1i; dy = dy + 1i) {
      if (dx != 0i || dy != 0i) {
        let nx = (i32(id.x) + dx + ${SIZE}i) % ${SIZE}i;
        let ny = (i32(id.y) + dy + ${SIZE}i) % ${SIZE}i;
        let neighborIndex = u32(nx) + u32(ny) * ${SIZE}u;
        neighbors += currentGrid[neighborIndex];
      }   
    }
  }
  
  if (cell == 1u && (neighbors < 2u || neighbors > 3u)) {
    nextGrid[index] = 0u; // Cell dies
  } else if (cell == 0u && neighbors == 3u) {
    nextGrid[index] = 1u; // Cell becomes alive
  } else {
    nextGrid[index] = cell; // Cell stays the same
  }
}`;

const renderShader = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<storage, read> grid: array<u32>;

// #e05d38
const ALIVE_COLOR: vec4<f32> = vec4<f32>(0.87, 0.36, 0.22, 1.0);
// #ffffff
const DEAD_COLOR: vec4<f32> = vec4<f32>(1.0, 1.0, 1.0, 1.0);

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let x = f32((vertexIndex << 1u) & 2u) * 2.0 - 1.0;
  let y = f32(vertexIndex & 2u) * 2.0 - 1.0;
  
  var output: VertexOutput;
  output.position = vec4<f32>(x, y, 0.0, 1.0);
  output.uv = vec2<f32>((x + 1.0) * 0.5, 1.0 - (y + 1.0) * 0.5);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  // Map UV coordinates to grid coordinates
  let gridCoord = vec2<u32>(input.uv * vec2<f32>(f32(${SIZE}), f32(${SIZE})));
  
  // Clamp to grid bounds
  let x = min(gridCoord.x, ${SIZE}u - 1u);
  let y = min(gridCoord.y, ${SIZE}u - 1u);
  
  let index = x + y * ${SIZE}u;
  let cell = grid[index];
  
  if (cell == 1u) {
    return ALIVE_COLOR;
  } else {
    return DEAD_COLOR;
  }
}`;

export function Conway() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGPURenderer | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const animationRef = useRef<number | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Step function
  const step = useCallback(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.step();
      renderer.render();
    }
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    step();
    return requestAnimationFrame(() => {
      if (isRunningRef.current) {
        animationRef.current = animate();
      } else {
        animationRef.current = null;
      }
    });
  }, [step]);

  // Start/Stop controls
  const start = useCallback(() => {
    if (!isRunning) {
      setIsRunning(true);
      animationRef.current = window.setTimeout(animate, STEP_INTERVAL_MS);
    }
  }, [isRunning, animate]);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Reset grid
  const reset = useCallback(() => {
    if (isRunning) return;
    const renderer = rendererRef.current;
    if (renderer) {
      const emptyGrid = new Uint32Array(SIZE * SIZE);
      renderer.grid = emptyGrid;
      renderer.setInitialGrid(emptyGrid);
      renderer.render();
    }
  }, [isRunning]);

  // Add a glider pattern for testing
  const addGlider = useCallback(() => {
    if (isRunning) return;
    const renderer = rendererRef.current;
    if (renderer) {
      const grid = new Uint32Array(SIZE * SIZE);
      // Glider pattern
      const gliderX = 10;
      const gliderY = 10;
      grid[gliderX + 1 + (gliderY + 0) * SIZE] = 1;
      grid[gliderX + 2 + (gliderY + 1) * SIZE] = 1;
      grid[gliderX + 0 + (gliderY + 2) * SIZE] = 1;
      grid[gliderX + 1 + (gliderY + 2) * SIZE] = 1;
      grid[gliderX + 2 + (gliderY + 2) * SIZE] = 1;

      renderer.grid = grid;
      renderer.setInitialGrid(grid);
      renderer.render();
    }
  }, [isRunning]);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new WebGPURenderer(canvas);
    rendererRef.current = renderer;
    renderer.init().then(() => {
      const initialGrid = new Uint32Array(
        Array.from({ length: SIZE * SIZE }, () => 0),
      );
      renderer.setInitialGrid(initialGrid);
      renderer.render();
    });
    // Resize handler
    const handleResize = () => {
      renderer.handleResize();
      renderer.render();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(canvas);

    const handlePointerDown = async (e: PointerEvent) => {
      // Check current running state from the ref
      if (isRunningRef.current) return; // Ignore clicks while running

      const rect = canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * SIZE);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * SIZE);
      const index = x + y * SIZE;

      // Read current state from GPU
      const currentGrid = await renderer.readGridFromGPU();
      currentGrid[index] = currentGrid[index] === 1 ? 0 : 1; // Toggle cell state
      renderer.grid = currentGrid; // Update CPU copy
      renderer.setInitialGrid(currentGrid); // Write to GPU
      renderer.render();
    };

    canvas.addEventListener("pointerdown", handlePointerDown);

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      canvas.removeEventListener("pointerdown", handlePointerDown);
      resizeObserver.disconnect();
      rendererRef.current = null;
    };
  }, []); // Remove dependencies to prevent re-initialization

  // Rerender on stop
  useEffect(() => {
    if (!isRunning) {
      const renderer = rendererRef.current;
      if (renderer) renderer.render();
    }
  }, [isRunning]);

  return (
    <div className="flex flex-col gap-1">
      <div className="aspect-square h-full w-full max-w-3xl rounded shadow-lg">
        <canvas className="h-full w-full" ref={canvasRef} />
      </div>
      <div className="flex gap-2">
        <Button onClick={step} disabled={isRunning}>
          Step
        </Button>
        <Button onClick={start} disabled={isRunning}>
          Start
        </Button>
        <Button onClick={stop} disabled={!isRunning}>
          Stop
        </Button>
        <Button onClick={reset} disabled={isRunning}>
          Reset
        </Button>
        <Button onClick={addGlider} disabled={isRunning}>
          Add Glider
        </Button>
      </div>
    </div>
  );
}

class WebGPURenderer {
  private canvas: HTMLCanvasElement;

  private device?: GPUDevice;
  private currentGridBuffer?: GPUBuffer;
  private nextGridBuffer?: GPUBuffer;
  private readBuffer?: GPUBuffer;

  private computePipeline?: GPUComputePipeline;
  private renderPipeline?: GPURenderPipeline;

  private renderBindGroup?: GPUBindGroup;
  private computeBindGroup?: GPUBindGroup;

  private format: GPUTextureFormat;
  private context: GPUCanvasContext;

  grid: Uint32Array = new Uint32Array(SIZE * SIZE);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const context = this.canvas.getContext("webgpu");

    if (!context) {
      throw new Error("WebGPU is not supported in this browser.");
    }

    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();
  }

  async init() {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("WebGPU not supported");
    }

    this.device = await adapter.requestDevice();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    this.currentGridBuffer = this.device.createBuffer({
      size: SIZE * SIZE * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.nextGridBuffer = this.device.createBuffer({
      size: SIZE * SIZE * 4,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    this.readBuffer = this.device.createBuffer({
      size: SIZE * SIZE * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const computeShaderModule = this.device.createShaderModule({
      code: computeShader,
    });

    const presentShaderModule = this.device.createShaderModule({
      code: renderShader,
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: computeShaderModule,
        entryPoint: "conway",
      },
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: presentShaderModule,
      },
      fragment: {
        module: presentShaderModule,
        targets: [
          {
            format: this.format,
          },
        ],
      },
    });

    this.handleResize();
  }

  handleResize() {
    const device = this.device;
    const computePipeline = this.computePipeline;
    const renderPipeline = this.renderPipeline;
    const currentGridBuffer = this.currentGridBuffer;
    const nextGridBuffer = this.nextGridBuffer;

    if (
      !device ||
      !computePipeline ||
      !renderPipeline ||
      !currentGridBuffer ||
      !nextGridBuffer
    ) {
      return;
    }

    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(
      1,
      Math.min(
        Math.floor(canvas.clientWidth * dpr),
        device.limits.maxTextureDimension2D,
      ),
    );
    const height = Math.max(
      1,
      Math.min(
        Math.floor(canvas.clientHeight * dpr),
        device.limits.maxTextureDimension2D,
      ),
    );
    canvas.width = width;
    canvas.height = height;

    this.updateBindGroups();
  }

  private updateBindGroups() {
    if (!this.device || !this.renderPipeline || !this.currentGridBuffer) {
      return;
    }

    // Update render bind group
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.currentGridBuffer,
          },
        },
      ],
    });

    // Update compute bind group
    if (this.computePipeline && this.nextGridBuffer) {
      this.computeBindGroup = this.device.createBindGroup({
        layout: this.computePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: this.currentGridBuffer,
            },
          },
          {
            binding: 1,
            resource: {
              buffer: this.nextGridBuffer,
            },
          },
        ],
      });
    }
  }

  setInitialGrid(grid: Uint32Array) {
    this.grid = grid;
    if (this.device && this.currentGridBuffer) {
      this.device.queue.writeBuffer(this.currentGridBuffer, 0, this.grid);
    }
  }

  step() {
    if (
      !this.device ||
      !this.computePipeline ||
      !this.currentGridBuffer ||
      !this.nextGridBuffer ||
      !this.computeBindGroup
    ) {
      return;
    }

    // Run compute shader
    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();

    passEncoder.setPipeline(this.computePipeline);
    passEncoder.setBindGroup(0, this.computeBindGroup);
    passEncoder.dispatchWorkgroups(
      Math.ceil(SIZE / WORKGROUP_SIZE),
      Math.ceil(SIZE / WORKGROUP_SIZE),
    );
    passEncoder.end();

    // Submit and wait for completion
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);

    // Swap buffers for next iteration
    [this.currentGridBuffer, this.nextGridBuffer] = [
      this.nextGridBuffer,
      this.currentGridBuffer,
    ];

    // Update bind groups to reference the swapped buffers
    this.updateBindGroups();
  }

  // Read current state back to CPU (only when needed, like for manual cell toggling)
  async readGridFromGPU(): Promise<Uint32Array> {
    if (!this.device || !this.currentGridBuffer || !this.readBuffer) {
      return this.grid;
    }

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      this.currentGridBuffer,
      0,
      this.readBuffer,
      0,
      SIZE * SIZE * 4,
    );
    this.device.queue.submit([commandEncoder.finish()]);

    await this.readBuffer.mapAsync(GPUMapMode.READ);
    const resultArray = new Uint32Array(this.readBuffer.getMappedRange());
    const result = new Uint32Array(resultArray);
    this.readBuffer.unmap();

    return result;
  }

  render() {
    if (!this.device || !this.renderPipeline || !this.renderBindGroup) {
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.renderPipeline);
    passEncoder.setBindGroup(0, this.renderBindGroup);
    passEncoder.draw(6); // Draw fullscreen quad
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }
}
