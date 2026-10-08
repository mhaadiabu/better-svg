import { NgTemplateOutlet, isPlatformBrowser } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  Renderer2,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { createSvgPresentation } from "../core/presentation";
import { withSvgColorOverrides } from "../core/colors";
import { createWebSvgController, mergeSvgAttributes, type WebSvgState } from "../core/web";

@Component({
  selector: "better-svg",
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state().status) {
      @case ("ready") {
        <svg #root [innerHTML]="html()"></svg>
      }
      @case ("loading") {
        <ng-container [ngTemplateOutlet]="loading() ?? null" />
      }
      @case ("error") {
        <ng-container [ngTemplateOutlet]="fallback() ?? null" />
      }
    }
  `,
})
export class SVG {
  readonly src = input<string>();
  readonly name = input<string>();
  readonly fetchOptions = input<RequestInit>();
  readonly cache = input(true);
  readonly sanitize = input(true);
  readonly uniqueIds = input(true);
  readonly loading = input<TemplateRef<unknown>>();
  readonly fallback = input<TemplateRef<unknown>>();
  readonly size = input<string | number>();
  readonly title = input<string>();
  readonly desc = input<string>();
  readonly width = input<string | number>();
  readonly height = input<string | number>();
  readonly viewBox = input<string>();
  readonly fill = input<string>();
  readonly stroke = input<string>();
  readonly role = input<string>();
  readonly ariaLabel = input<string>();
  readonly ariaHidden = input<boolean | "true" | "false">();
  readonly svgClass = input<string>();
  readonly svgStyle = input<string>();
  readonly svgLoad = output<string>();
  readonly svgError = output<Error>();

  protected readonly state = signal<WebSvgState>({ status: "loading" });
  private readonly present = createSvgPresentation();
  protected readonly content = computed(() => {
    const state = this.state();
    if (state.status !== "ready") return undefined;
    const colored = withSvgColorOverrides(state.content, {
      fill: this.fill(),
      stroke: this.stroke(),
    });
    return this.present(colored, { title: this.title(), desc: this.desc() });
  });
  protected readonly html = computed(() => {
    const content = this.content();
    return content ? this.sanitizer.bypassSecurityTrustHtml(content.innerHTML) : undefined;
  });
  private readonly root = viewChild<ElementRef<SVGSVGElement>>("root");
  private readonly renderer = inject(Renderer2);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly controller = createWebSvgController();

  constructor() {
    effect((onCleanup) => {
      if (!this.browser) return;
      const options = {
        src: this.src(),
        name: this.name(),
        fetchOptions: this.fetchOptions(),
        cache: this.cache(),
        sanitize: this.sanitize(),
        uniqueIds: this.uniqueIds(),
        onSvgLoad: (markup: string) => this.svgLoad.emit(markup),
        onSvgError: (error: Error) => this.svgError.emit(error),
      };
      untracked(
        () =>
          void this.controller.load(options, (state) => {
            this.state.set(state);
          }),
      );
      onCleanup(() => this.controller.abort());
    });

    effect((onCleanup) => {
      const root = this.root()?.nativeElement;
      const content = this.content();
      if (!root || !content) return;
      const attrs = mergeSvgAttributes(content, {
        size: this.size(),
        width: this.width(),
        height: this.height(),
        viewBox: this.viewBox(),
        fill: this.fill(),
        stroke: this.stroke(),
        role: this.role(),
        "aria-label": this.ariaLabel(),
        "aria-hidden": this.ariaHidden(),
        class: this.svgClass(),
        style: this.svgStyle(),
      });
      for (const [name, value] of Object.entries(attrs)) {
        if (value !== undefined) this.renderer.setAttribute(root, name, String(value));
      }
      onCleanup(() => {
        for (const name of Object.keys(attrs)) this.renderer.removeAttribute(root, name);
      });
    });
  }
}

export default SVG;
