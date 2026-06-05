import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// AI 답변을 다채롭고 정리된 마크다운 형태로 렌더링
export default function ChatMarkdown({ content }: { content: string }) {
  return (
    <div
      className="prose prose-sm max-w-none text-gray-800
        prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-1.5
        prose-h1:text-base prose-h1:text-indigo-700 prose-h1:border-b prose-h1:border-indigo-100 prose-h1:pb-1
        prose-h2:text-sm prose-h2:text-violet-700
        prose-h3:text-sm prose-h3:text-sky-700
        prose-p:my-1.5 prose-p:leading-relaxed
        prose-strong:text-rose-600 prose-strong:font-semibold
        prose-em:text-amber-600
        prose-ul:my-1.5 prose-ul:pl-4 prose-ol:my-1.5 prose-ol:pl-4 prose-li:my-0.5
        prose-li:marker:text-indigo-400
        prose-a:text-blue-600 prose-a:font-medium prose-a:underline hover:prose-a:text-blue-800
        prose-hr:my-3 prose-hr:border-gray-200"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 인라인 코드 + 코드블록 색상 구분
          code({ className, children, ...props }: any) {
            const isBlock = /language-/.test(className || '')
            if (isBlock) {
              return (
                <code className={`${className || ''} text-emerald-200`} {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code
                className="bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded text-[12px] font-mono border border-pink-100"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre({ children }: any) {
            return (
              <pre className="bg-slate-900 text-emerald-100 rounded-lg p-3 my-2 overflow-auto text-[12px] leading-relaxed shadow-sm">
                {children}
              </pre>
            )
          },
          blockquote({ children }: any) {
            return (
              <blockquote className="border-l-4 border-amber-300 bg-amber-50 text-amber-800 pl-3 pr-2 py-1.5 my-2 rounded-r-md not-italic">
                {children}
              </blockquote>
            )
          },
          // 표: 컬러 헤더 + 줄무늬
          table({ children }: any) {
            return (
              <div className="my-2 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full border-collapse text-[13px]">{children}</table>
              </div>
            )
          },
          thead({ children }: any) {
            return <thead className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white">{children}</thead>
          },
          th({ children }: any) {
            return <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">{children}</th>
          },
          tr({ children }: any) {
            return <tr className="even:bg-indigo-50/40 border-t border-gray-100">{children}</tr>
          },
          td({ children }: any) {
            return <td className="px-3 py-1.5 align-top">{children}</td>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
